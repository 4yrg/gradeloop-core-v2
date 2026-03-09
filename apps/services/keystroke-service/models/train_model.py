"""
train_model.py
--------------
TypeNet pre-training on the full Aalto 136M-Keystrokes dataset.

Pre-requisite
-------------
Run the preprocessing step first:

    python models/preprocess_full_dataset.py \
        --zip dataset/Keystrokes.zip \
        --out models/aalto_full.h5

Then train:

    python models/train_model.py \
        [--data models/aalto_full.h5] \
        [--out  models/typenet_pretrained.pth] \
        [--epochs 100] [--batch 512] [--workers 4]

The script also accepts the legacy .npy format for backward compatibility.
"""

import argparse
import time
from pathlib import Path

import h5py
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

# ──────────────────────────────────────────────────────────────
# DEFAULT HYPERPARAMETERS (TypeNet paper values)
# ──────────────────────────────────────────────────────────────
INPUT_SIZE      = 5      # [HL, IL, PL, RL, KeyCode]
HIDDEN_SIZE     = 128    # LSTM hidden units per layer
NUM_LAYERS      = 2      # stacked LSTM layers
OUTPUT_SIZE     = 128    # embedding dimension
DROPOUT_RATE    = 0.5
SEQUENCE_LENGTH = 70
BATCH_SIZE      = 512
LEARNING_RATE   = 0.005
MARGIN          = 1.5    # triplet loss margin
EPOCHS          = 100

DEFAULT_DATA_PATH  = "models/aalto_full.h5"
DEFAULT_MODEL_PATH = "models/typenet_pretrained.pth"
CHECKPOINT_EVERY   = 10   # save every N epochs


# ──────────────────────────────────────────────────────────────
# DATASET  — HDF5-backed (memory-mapped, no full RAM load)
# ──────────────────────────────────────────────────────────────
class HDF5KeystrokeTripletDataset(Dataset):
    """
    Yields (anchor, positive, negative) triplets directly from an HDF5 file
    produced by preprocess_full_dataset.py.

    Layout expected:
      sequences  (N_total, SEQ_LEN, 5)  float32
      labels     (N_total,)             int32   consecutive user indices
      index_map  (N_users, 2)           int64   [seq_start, seq_end) per user

    The file is memory-mapped so only the requested slices are loaded from
    disk; the full file does NOT need to fit in RAM.
    """

    def __init__(self, h5_path: "str | Path", triplets_per_user: int = 10):
        self.h5_path           = str(h5_path)
        self.triplets_per_user = triplets_per_user

        with h5py.File(self.h5_path, "r") as hf:
            self.n_users   = int(hf.attrs["n_users"])
            self.n_seqs    = int(hf.attrs["n_sequences"])
            # index_map is tiny — safe to keep in RAM
            self.index_map = hf["index_map"][:]   # (n_users, 2) int64

        print(
            f"[HDF5Dataset] users={self.n_users:,}  "
            f"sequences={self.n_seqs:,}  "
            f"triplets/epoch~{self.n_users * triplets_per_user:,}"
        )
        self._hf = None   # opened lazily per DataLoader worker

    def _open(self):
        if self._hf is None:
            self._hf = h5py.File(self.h5_path, "r", swmr=True)

    def __len__(self) -> int:
        return self.n_users * self.triplets_per_user

    def __getitem__(self, index: int):
        self._open()

        anchor_user       = index % self.n_users
        a_start, a_end    = self.index_map[anchor_user]
        a_count           = int(a_end - a_start)

        # Anchor + positive from same user
        seq_idxs       = np.random.choice(a_count, size=2, replace=(a_count < 2))
        anchor_seq_idx = int(a_start) + seq_idxs[0]
        pos_seq_idx    = int(a_start) + seq_idxs[1]

        # Negative from a different user
        neg_user = np.random.randint(0, self.n_users)
        while neg_user == anchor_user:
            neg_user = np.random.randint(0, self.n_users)
        n_start, n_end = self.index_map[neg_user]
        n_count        = int(n_end - n_start)
        neg_seq_idx    = int(n_start) + np.random.randint(0, n_count)

        seqs     = self._hf["sequences"]
        anchor   = torch.from_numpy(seqs[anchor_seq_idx].astype(np.float32))
        positive = torch.from_numpy(seqs[pos_seq_idx].astype(np.float32))
        negative = torch.from_numpy(seqs[neg_seq_idx].astype(np.float32))
        return anchor, positive, negative

    def __del__(self):
        if self._hf is not None:
            try:
                self._hf.close()
            except Exception:
                pass


# ──────────────────────────────────────────────────────────────
# LEGACY DATASET — .npy (backward compat with old Colab files)
# ──────────────────────────────────────────────────────────────
class NpyKeystrokeTripletDataset(Dataset):
    """Loads old-style .npy with shape (N_users, K_seqs, SEQ_LEN, 5)."""

    def __init__(self, npy_path: str, triplets_per_user: int = 10):
        print(f"[NpyDataset] Loading {npy_path} …")
        self.data              = np.load(npy_path, allow_pickle=True)
        self.n_users           = self.data.shape[0]
        self.n_seqs            = self.data.shape[1]
        self.triplets_per_user = triplets_per_user
        print(f"[NpyDataset] users={self.n_users}  seqs/user={self.n_seqs}")

    def __len__(self):
        return self.n_users * self.triplets_per_user

    def __getitem__(self, index):
        anchor_user = index % self.n_users
        seq_idxs    = np.random.choice(self.n_seqs, size=2, replace=False)
        anchor      = torch.from_numpy(self.data[anchor_user, seq_idxs[0]].astype(np.float32))
        positive    = torch.from_numpy(self.data[anchor_user, seq_idxs[1]].astype(np.float32))

        neg_user = np.random.randint(0, self.n_users)
        while neg_user == anchor_user:
            neg_user = np.random.randint(0, self.n_users)
        neg_seq  = np.random.randint(0, self.n_seqs)
        negative = torch.from_numpy(self.data[neg_user, neg_seq].astype(np.float32))
        return anchor, positive, negative


def build_dataset(data_path: str, triplets_per_user: int) -> Dataset:
    """Auto-detect .h5 / .npy and return the right Dataset."""
    p = Path(data_path)
    if not p.exists():
        raise FileNotFoundError(
            f"Data file not found: {data_path}\n"
            "Run:  python models/preprocess_full_dataset.py --zip dataset/Keystrokes.zip"
        )
    if p.suffix in (".h5", ".hdf5"):
        return HDF5KeystrokeTripletDataset(p, triplets_per_user)
    if p.suffix == ".npy":
        return NpyKeystrokeTripletDataset(str(p), triplets_per_user)
    raise ValueError(f"Unknown data format: {p.suffix}  (expected .h5 or .npy)")


# ──────────────────────────────────────────────────────────────
# MODEL — TypeNet Architecture
# ──────────────────────────────────────────────────────────────
class TypeNet(nn.Module):
    """
    Two-layer LSTM with BatchNorm, Dropout, and a linear projection head.
    Outputs L2-normalised 128-d embeddings.
    """

    def __init__(self):
        super().__init__()
        self.lstm1 = nn.LSTM(INPUT_SIZE,  HIDDEN_SIZE, batch_first=True)
        self.bn1   = nn.BatchNorm1d(HIDDEN_SIZE)
        self.drop1 = nn.Dropout(DROPOUT_RATE)

        self.lstm2 = nn.LSTM(HIDDEN_SIZE, HIDDEN_SIZE, batch_first=True)
        self.bn2   = nn.BatchNorm1d(HIDDEN_SIZE)
        self.drop2 = nn.Dropout(DROPOUT_RATE)

        self.fc    = nn.Linear(HIDDEN_SIZE, OUTPUT_SIZE)

    def forward_one(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm1(x)
        out    = self.bn1(out.permute(0, 2, 1)).permute(0, 2, 1)
        out    = self.drop1(out)

        out, _ = self.lstm2(out)
        out    = self.bn2(out.permute(0, 2, 1)).permute(0, 2, 1)
        out    = self.drop2(out)

        emb = self.fc(out[:, -1, :])
        return nn.functional.normalize(emb, p=2, dim=1)

    def forward(self, a, p, n):
        return self.forward_one(a), self.forward_one(p), self.forward_one(n)


# ──────────────────────────────────────────────────────────────
# LOSS — Triplet Loss
# ──────────────────────────────────────────────────────────────
class TripletLoss(nn.Module):
    def __init__(self, margin: float = MARGIN):
        super().__init__()
        self.margin = margin

    def forward(self, anchor, positive, negative):
        dist_pos = torch.pow(anchor - positive, 2).sum(dim=1)
        dist_neg = torch.pow(anchor - negative, 2).sum(dim=1)
        return torch.relu(dist_pos - dist_neg + self.margin).mean()


# ──────────────────────────────────────────────────────────────
# TRAINING
# ──────────────────────────────────────────────────────────────
def train(args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"  TypeNet — full-dataset training")
    print(f"  Device  : {device}")
    print(f"  Data    : {args.data}")
    print(f"  Output  : {args.out}")
    print(f"{'='*60}\n")

    dataset = build_dataset(args.data, args.triplets_per_user)
    loader  = DataLoader(
        dataset,
        batch_size         = args.batch,
        shuffle            = True,
        num_workers        = args.workers,
        pin_memory         = (device.type == "cuda"),
        persistent_workers = (args.workers > 0),
    )

    model     = TypeNet().to(device)
    criterion = TripletLoss(margin=args.margin)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=args.lr * 0.01
    )

    out_path  = Path(args.out)
    ckpt_path = out_path.with_suffix(".ckpt.pth")
    start_epoch = 0
    best_loss   = float("inf")

    if args.resume and ckpt_path.exists():
        ckpt = torch.load(ckpt_path, map_location=device)
        model.load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        scheduler.load_state_dict(ckpt["scheduler"])
        start_epoch = ckpt["epoch"]
        best_loss   = ckpt.get("loss", best_loss)
        print(f"Resumed from checkpoint at epoch {start_epoch}  (loss={best_loss:.4f})\n")

    for epoch in range(start_epoch, args.epochs):
        model.train()
        total_loss = 0.0
        t0         = time.time()

        for batch_idx, (anchor, pos, neg) in enumerate(loader):
            anchor = anchor.to(device)
            pos    = pos.to(device)
            neg    = neg.to(device)

            optimizer.zero_grad()
            e_a, e_p, e_n = model(anchor, pos, neg)
            loss = criterion(e_a, e_p, e_n)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
            optimizer.step()

            total_loss += loss.item()
            if batch_idx % 50 == 0:
                print(
                    f"  Epoch {epoch+1:>3}/{args.epochs}  "
                    f"Batch {batch_idx:>5}/{len(loader)}  "
                    f"Loss {loss.item():.4f}",
                    flush=True,
                )

        scheduler.step()
        avg_loss = total_loss / len(loader)
        elapsed  = time.time() - t0
        print(
            f"\nEpoch [{epoch+1}/{args.epochs}]  "
            f"AvgLoss={avg_loss:.4f}  "
            f"LR={scheduler.get_last_lr()[0]:.6f}  "
            f"Time={elapsed:.0f}s\n"
        )

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss
            out_path.parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), out_path)
            print(f"  ✓ Best model saved → {out_path}  (loss={best_loss:.4f})")

        # Periodic checkpoint (for resuming)
        if (epoch + 1) % CHECKPOINT_EVERY == 0:
            torch.save(
                {
                    "epoch":     epoch + 1,
                    "model":     model.state_dict(),
                    "optimizer": optimizer.state_dict(),
                    "scheduler": scheduler.state_dict(),
                    "loss":      avg_loss,
                },
                ckpt_path,
            )
            print(f"  ✓ Checkpoint saved → {ckpt_path}")

    print(f"\nTraining complete.  Best loss: {best_loss:.4f}")
    print(f"Final model: {out_path}")


# ──────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────
def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train TypeNet on the full Aalto dataset")
    p.add_argument("--data",   default=DEFAULT_DATA_PATH,
                   help="Path to aalto_full.h5 (or legacy .npy)")
    p.add_argument("--out",    default=DEFAULT_MODEL_PATH,
                   help="Where to save the best model weights (.pth)")
    p.add_argument("--epochs", type=int,   default=EPOCHS)
    p.add_argument("--batch",  type=int,   default=BATCH_SIZE)
    p.add_argument("--lr",     type=float, default=LEARNING_RATE)
    p.add_argument("--margin", type=float, default=MARGIN)
    p.add_argument("--workers",type=int,   default=4,
                   help="DataLoader worker count (0 = main process only)")
    p.add_argument("--triplets_per_user", type=int, default=10)
    p.add_argument("--resume", action="store_true",
                   help="Resume from latest checkpoint if it exists")
    return p.parse_args()


if __name__ == "__main__":
    train(_parse_args())
