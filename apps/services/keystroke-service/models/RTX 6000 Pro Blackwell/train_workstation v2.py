from __future__ import annotations
import argparse
import multiprocessing

import h5py
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from tqdm.auto import tqdm


# ─────────────────────────────────────────────
# HYPERPARAMETERS (UPDATED)
# ─────────────────────────────────────────────
INPUT_SIZE  = 5
HIDDEN_SIZE = 128
OUTPUT_SIZE = 128
DROPOUT_RATE = 0.5

SEQ_LEN = 30

BATCH_SIZE = 512

# 🔴 FIXED
LEARNING_RATE = 0.001

# 🔴 FIXED
MARGIN = 0.5

EPOCHS = 100
TRIPLETS_PER_USER = 10

TRAIN_RATIO = 0.80
VAL_RATIO   = 0.10
TEST_RATIO  = 0.10

EARLY_STOPPING_PATIENCE = 12


# ─────────────────────────────────────────────
# GPU CONFIG
# ─────────────────────────────────────────────
def configure_gpu():

    if not torch.cuda.is_available():
        print("CUDA not available.")
        return torch.device("cpu"), torch.float16

    device = torch.device("cuda")
    gpu = torch.cuda.get_device_properties(0)

    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True

    amp_dtype = torch.bfloat16 if gpu.major >= 8 else torch.float16

    print("GPU:", gpu.name)
    print("VRAM:", gpu.total_memory // 1024**3, "GB")

    return device, amp_dtype


# ─────────────────────────────────────────────
# DATASET
# ─────────────────────────────────────────────
class RamTripletDataset(Dataset):

    def __init__(self, h5_path, user_indices=None, sequences=None):

        with h5py.File(h5_path, "r") as hf:

            self.index_map = hf["index_map"][:]

            if sequences is None:
                print("Loading sequences to RAM...")
                self.sequences = hf["sequences"][:]
            else:
                self.sequences = sequences

        if user_indices is None:
            user_indices = np.arange(len(self.index_map))

        self.user_indices = user_indices
        self.index_map = self.index_map[user_indices]

        self.n_users = len(user_indices)

    def __len__(self):
        return self.n_users * TRIPLETS_PER_USER

    def __getitem__(self, idx):

        anc_user = idx % self.n_users

        a_start, a_end = self.index_map[anc_user]
        a_count = a_end - a_start

        picks = np.random.choice(a_count, 2)

        a_idx = a_start + picks[0]
        p_idx = a_start + picks[1]

        neg_user = np.random.randint(0, self.n_users)

        while neg_user == anc_user:
            neg_user = np.random.randint(0, self.n_users)

        n_start, n_end = self.index_map[neg_user]
        n_idx = n_start + np.random.randint(0, n_end - n_start)

        return (
            torch.from_numpy(self.sequences[a_idx]),
            torch.from_numpy(self.sequences[p_idx]),
            torch.from_numpy(self.sequences[n_idx]),
        )


# ─────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────
class TypeNet(nn.Module):

    def __init__(self):
        super().__init__()

        self.lstm1 = nn.LSTM(INPUT_SIZE, HIDDEN_SIZE, batch_first=True)
        self.bn1 = nn.BatchNorm1d(HIDDEN_SIZE)
        self.drop1 = nn.Dropout(DROPOUT_RATE)

        self.lstm2 = nn.LSTM(HIDDEN_SIZE, HIDDEN_SIZE, batch_first=True)
        self.bn2 = nn.BatchNorm1d(HIDDEN_SIZE)
        self.drop2 = nn.Dropout(DROPOUT_RATE)

        self.fc = nn.Linear(HIDDEN_SIZE, OUTPUT_SIZE)

    def forward_one(self, x):

        out, _ = self.lstm1(x)
        out = self.bn1(out.permute(0,2,1)).permute(0,2,1)
        out = self.drop1(out)

        out, _ = self.lstm2(out)
        out = self.bn2(out.permute(0,2,1)).permute(0,2,1)
        out = self.drop2(out)

        emb = self.fc(out[:, -1, :])

        return F.normalize(emb, dim=1)

    def forward(self, a,p,n):

        return (
            self.forward_one(a),
            self.forward_one(p),
            self.forward_one(n)
        )


# ─────────────────────────────────────────────
# LOSS
# ─────────────────────────────────────────────
class TripletLoss(nn.Module):

    def __init__(self, margin=MARGIN):
        super().__init__()
        self.margin = margin

    def forward(self,a,p,n):

        d_pos = (a-p).pow(2).sum(1)
        d_neg = (a-n).pow(2).sum(1)

        return F.relu(d_pos - d_neg + self.margin).mean()


# ─────────────────────────────────────────────
# USER SPLIT
# ─────────────────────────────────────────────
def make_user_splits(h5_path):

    with h5py.File(h5_path,"r") as hf:
        n_users = hf.attrs["n_users"]

    rng = np.random.default_rng(42)
    idx = rng.permutation(n_users)

    n_train = int(n_users*TRAIN_RATIO)
    n_val   = int(n_users*VAL_RATIO)

    return idx[:n_train], idx[n_train:n_train+n_val], idx[n_train+n_val:]


# ─────────────────────────────────────────────
# TRAIN
# ─────────────────────────────────────────────
def train(args):

    device, amp_dtype = configure_gpu()

    use_amp = device.type=="cuda"

    train_idx, val_idx, test_idx = make_user_splits(args.data)

    print("Loading sequences...")
    with h5py.File(args.data,"r") as hf:
        seqs = hf["sequences"][:]

    train_ds = RamTripletDataset(args.data, train_idx, seqs)
    val_ds   = RamTripletDataset(args.data, val_idx, seqs)

    workers = min(8, multiprocessing.cpu_count())

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch,
        shuffle=True,
        num_workers=workers,
        pin_memory=True,
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch,
        shuffle=False,
        num_workers=workers,
        pin_memory=True,
    )

    model = TypeNet().to(device)

    if args.compile:
        model = torch.compile(model)

    optimizer = optim.Adam(model.parameters(), lr=args.lr)


    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=args.epochs
    )

    criterion = TripletLoss()

    # 🔴 FIXED AMP
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_val = float("inf")
    patience = 0

    for epoch in range(args.epochs):

        model.train()
        train_loss=0

        bar = tqdm(train_loader)

        for a,p,n in bar:

            a=a.to(device)
            p=p.to(device)
            n=n.to(device)

            optimizer.zero_grad()

            with torch.autocast("cuda",dtype=amp_dtype,enabled=use_amp):

                ea,ep,en = model(a,p,n)

                loss = criterion(ea,ep,en)

            scaler.scale(loss).backward()

            scaler.unscale_(optimizer)

            # 🔴 STRONGER CLIPPING
            nn.utils.clip_grad_norm_(model.parameters(),1.0)

            scaler.step(optimizer)
            scaler.update()

            train_loss+=loss.item()

        model.eval()
        val_loss=0

        with torch.no_grad():

            for a,p,n in val_loader:

                a=a.to(device)
                p=p.to(device)
                n=n.to(device)

                with torch.autocast("cuda",dtype=amp_dtype,enabled=use_amp):

                    ea,ep,en = model(a,p,n)

                    val_loss+=criterion(ea,ep,en).item()

        train_loss/=len(train_loader)
        val_loss/=len(val_loader)

        scheduler.step()

        print(f"Epoch {epoch+1}  train={train_loss:.4f}  val={val_loss:.4f}")

        if val_loss < best_val:

            best_val = val_loss
            patience=0

            torch.save(model.state_dict(), args.out)

        else:

            patience+=1

            if patience >= EARLY_STOPPING_PATIENCE:

                print("Early stopping triggered")
                break


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────
def parse():

    p=argparse.ArgumentParser()

    p.add_argument("--data",required=True)
    p.add_argument("--out",default="typenet_pretrained.pth")

    p.add_argument("--epochs",type=int,default=EPOCHS)
    p.add_argument("--batch",type=int,default=BATCH_SIZE)

    p.add_argument("--lr",type=float,default=LEARNING_RATE)

    p.add_argument("--compile",action="store_true")

    return p.parse_args()


if __name__ == "__main__":

    args=parse()

    train(args)