"""
train_workstation.py
--------------------
TypeNet pre-training on the full Aalto 136M-Keystrokes dataset.
Optimised for RTX 6000 Pro Blackwell (or any high-VRAM workstation GPU).

Key differences from train_model.py / Colab notebook
-----------------------------------------------------
* Full 2.7 GB HDF5 loaded into a shared RAM numpy array (no file I/O hot path).
* Mixed-precision (BF16 on Blackwell/Ampere, FP16 fallback) via torch.cuda.amp.
* torch.compile() — PyTorch 2.x graph compilation for ~20-30 % speed-up.
* TF32 matmul + cuDNN enabled for Ampere/Ada/Blackwell tensor cores.
* cudnn.benchmark = True  (fixed sequence length → stable kernel selection).
* Batch size 512 — matches Colab notebook for best generalisation (gradient noise acts
  as implicit regularisation, critical for embedding quality on unseen users).
* Auto-detected CPU worker count for DataLoader.
* Per-user 80/10/10 train/val/test split mirroring the Colab notebook.
* Validation loss tracked every epoch; best model saved on val loss improvement.
* Loss curves saved to PNG at end of training.
* Resumable checkpoints (same format as Colab notebook).

Quick start
-----------
  # (from project root)
  python apps/services/keystroke-service/models/train_workstation.py \\
      --data  apps/services/keystroke-service/models/aalto_full.h5 \\
      --out   apps/services/keystroke-service/models/typenet_pretrained.pth \\
      --epochs 100

Pre-requisite
-------------
  python apps/services/keystroke-service/models/preprocess_full_dataset.py \\
      --zip  <path/to/Keystrokes.zip> \\
      --out  apps/services/keystroke-service/models/aalto_full.h5

Tested with: Python 3.10+, PyTorch 2.3+, CUDA 12.4+
"""

from __future__ import annotations

import argparse
import csv
import json
import multiprocessing
import os
import time
from pathlib import Path

import h5py
import numpy as np
import torch
try:
    import gdown
except ImportError:
    gdown = None  # lazy check in download helper
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from tqdm.auto import tqdm

# ──────────────────────────────────────────────────────────────────────────────
# DEFAULT HYPERPARAMETERS
# (match the Colab notebook — change via CLI args if needed)
# ──────────────────────────────────────────────────────────────────────────────
INPUT_SIZE        = 5       # [HL, IL, PL, RL, KeyCode]
HIDDEN_SIZE       = 128     # LSTM hidden units per layer
OUTPUT_SIZE       = 128     # embedding dimension
DROPOUT_RATE      = 0.5

SEQ_LEN           = 30      # must match the value used during preprocessing
BATCH_SIZE        = 512     # matches Colab notebook — best generalisation for user verification
LEARNING_RATE     = 0.005
MARGIN            = 1.5     # triplet loss margin
EPOCHS            = 100
TRIPLETS_PER_USER = 10
CHECKPOINT_EVERY  = 5       # save checkpoint every N epochs

TRAIN_RATIO = 0.80
VAL_RATIO   = 0.10
TEST_RATIO  = 0.10
SPLIT_SEED  = 42


# ──────────────────────────────────────────────────────────────────────────────
# GOOGLE DRIVE DOWNLOAD
# ──────────────────────────────────────────────────────────────────────────────
_GDRIVE_FILE_ID  = "1HQcqaGhPKYfQvT1zMJLyxB7za1dsU1Ro"
_GDRIVE_GDRIVE_URL = f"https://drive.google.com/uc?id={_GDRIVE_FILE_ID}"


def download_h5_if_missing(dest: str | Path) -> None:
    """
    Download aalto_full.h5 from Google Drive if it does not exist at `dest`.
    Requires the `gdown` package:  pip install gdown
    """
    dest = Path(dest)
    if dest.exists():
        size_gb = dest.stat().st_size / 1e9
        print(f"✅ HDF5 already exists: {dest}  ({size_gb:.2f} GB) — skipping download.")
        return

    if gdown is None:
        raise ImportError(
            "gdown is required to download the dataset.\n"
            "Install it with:  pip install gdown"
        )

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading aalto_full.h5 from Google Drive …")
    print(f"  → {dest}")
    print("  (file is ~1.25 GB — this may take a few minutes)\n")

    t0 = time.perf_counter()
    gdown.download(
        url    = _GDRIVE_GDRIVE_URL,
        output = str(dest),
        quiet  = False,
        fuzzy  = True,   # handles /view?usp=sharing URLs as well
    )
    elapsed = time.perf_counter() - t0

    if not dest.exists():
        raise RuntimeError(
            f"Download failed — {dest} was not created.\n"
            "If gdown is blocked by a Google Drive quota error, download the\n"
            f"file manually from:\n"
            f"  https://drive.google.com/file/d/{_GDRIVE_FILE_ID}/view\n"
            f"and place it at: {dest}"
        )

    size_gb = dest.stat().st_size / 1e9
    print(f"\n✅ Download complete in {elapsed/60:.1f} min  ({size_gb:.2f} GB)")


# ──────────────────────────────────────────────────────────────────────────────
# GPU SETUP — Blackwell/Ada/Ampere tensor-core tuning
# ──────────────────────────────────────────────────────────────────────────────
def configure_gpu() -> torch.device:
    """Enable all Ampere/Ada/Blackwell tensor-core optimisations."""
    if not torch.cuda.is_available():
        print("⚠  CUDA not available — training on CPU (will be slow).")
        return torch.device("cpu")

    device = torch.device("cuda")
    gpu    = torch.cuda.get_device_properties(0)

    # TF32 — free ~2x throughput on Ampere+ for matrix multiplications
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32       = True

    # cuDNN auto-tuner — fixed sequence length means stable kernel choice
    torch.backends.cudnn.benchmark        = True

    # Choose AMP dtype: BF16 on Blackwell/Ampere (sm_80+), FP16 elsewhere
    cc_major = gpu.major
    amp_dtype = torch.bfloat16 if cc_major >= 8 else torch.float16

    print(f"GPU     : {gpu.name}  ({gpu.total_memory // 1024**3} GB VRAM)")
    print(f"CUDA    : {torch.version.cuda}")
    print(f"PyTorch : {torch.__version__}")
    print(f"Compute : sm_{gpu.major}{gpu.minor}")
    print(f"AMP     : {amp_dtype}  (TF32={'on' if cc_major >= 8 else 'off'})")
    return device, amp_dtype


# ──────────────────────────────────────────────────────────────────────────────
# DATASET — full RAM-backed triplet dataset
# ──────────────────────────────────────────────────────────────────────────────
class RamTripletDataset(Dataset):
    """
    Holds the entire sequences numpy array in CPU RAM.
    __getitem__ is a pure numpy index — zero disk I/O on the hot path.

    Pass the `sequences` kwarg when constructing train and val splits so the
    2.7 GB array is only loaded once and shared between both datasets.
    """

    def __init__(
        self,
        h5_path: str | Path,
        user_indices: np.ndarray | None = None,
        triplets_per_user: int = TRIPLETS_PER_USER,
        sequences: np.ndarray | None = None,
    ):
        self.triplets_per_user = triplets_per_user

        with h5py.File(str(h5_path), "r") as hf:
            total_users    = int(hf.attrs["n_users"])
            full_index_map = hf["index_map"][:]           # (total_users, 2)

            if sequences is None:
                t0 = time.perf_counter()
                print(f"  Loading sequences into RAM from {h5_path} …", flush=True)
                self.sequences = hf["sequences"][:]       # (N, SEQ_LEN, 5) float32
                elapsed = time.perf_counter() - t0
                print(
                    f"  ✅  {self.sequences.shape[0]:,} seqs  "
                    f"({self.sequences.nbytes / 1e9:.2f} GB)  "
                    f"loaded in {elapsed:.1f}s",
                    flush=True,
                )
            else:
                self.sequences = sequences                # shared — zero copy

        if user_indices is None:
            user_indices = np.arange(total_users, dtype=np.int64)

        self.user_indices = np.asarray(user_indices, dtype=np.int64)
        self.index_map    = full_index_map[self.user_indices]   # (n_users, 2)
        self.n_users      = len(self.user_indices)

        print(
            f"  [Dataset]  users={self.n_users:,}  "
            f"triplets/epoch≈{self.n_users * triplets_per_user:,}",
            flush=True,
        )

    def __len__(self) -> int:
        return self.n_users * self.triplets_per_user

    def __getitem__(self, idx: int):
        anc_user        = idx % self.n_users
        a_start, a_end  = self.index_map[anc_user]
        a_count         = int(a_end - a_start)

        picks   = np.random.choice(a_count, 2, replace=(a_count < 2))
        a_idx   = int(a_start) + picks[0]
        p_idx   = int(a_start) + picks[1]

        neg_user = np.random.randint(0, self.n_users)
        while neg_user == anc_user:
            neg_user = np.random.randint(0, self.n_users)
        n_start, n_end = self.index_map[neg_user]
        n_idx = int(n_start) + np.random.randint(0, int(n_end - n_start))

        return (
            torch.from_numpy(self.sequences[a_idx]),
            torch.from_numpy(self.sequences[p_idx]),
            torch.from_numpy(self.sequences[n_idx]),
        )


# ──────────────────────────────────────────────────────────────────────────────
# MODEL — TypeNet
# ──────────────────────────────────────────────────────────────────────────────
class TypeNet(nn.Module):
    """
    Two stacked LSTMs with BatchNorm, Dropout, and a linear projection.
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

        self.fc = nn.Linear(HIDDEN_SIZE, OUTPUT_SIZE)

    def forward_one(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm1(x)
        out    = self.bn1(out.permute(0, 2, 1)).permute(0, 2, 1)
        out    = self.drop1(out)

        out, _ = self.lstm2(out)
        out    = self.bn2(out.permute(0, 2, 1)).permute(0, 2, 1)
        out    = self.drop2(out)

        return F.normalize(self.fc(out[:, -1, :]), p=2, dim=1)

    def forward(self, a: torch.Tensor, p: torch.Tensor, n: torch.Tensor):
        return self.forward_one(a), self.forward_one(p), self.forward_one(n)


# ──────────────────────────────────────────────────────────────────────────────
# LOSS
# ──────────────────────────────────────────────────────────────────────────────
class TripletLoss(nn.Module):
    def __init__(self, margin: float = MARGIN):
        super().__init__()
        self.margin = margin

    def forward(
        self, a: torch.Tensor, p: torch.Tensor, n: torch.Tensor
    ) -> torch.Tensor:
        d_pos = (a - p).pow(2).sum(dim=1)
        d_neg = (a - n).pow(2).sum(dim=1)
        return F.relu(d_pos - d_neg + self.margin).mean()


# ──────────────────────────────────────────────────────────────────────────────
# SPLIT UTILITY
# ──────────────────────────────────────────────────────────────────────────────
def make_user_splits(
    h5_path: str | Path,
    train_ratio: float = TRAIN_RATIO,
    val_ratio: float   = VAL_RATIO,
    seed: int          = SPLIT_SEED,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Deterministic per-user 80/10/10 shuffle split."""
    with h5py.File(str(h5_path), "r") as hf:
        n_total = int(hf.attrs["n_users"])

    rng     = np.random.default_rng(seed)
    indices = rng.permutation(n_total)

    n_train = int(n_total * train_ratio)
    n_val   = int(n_total * val_ratio)

    train_idx = indices[:n_train]
    val_idx   = indices[n_train : n_train + n_val]
    test_idx  = indices[n_train + n_val :]

    print(
        f"User split (seed={seed}) ─── "
        f"total={n_total:,}  "
        f"train={len(train_idx):,}  "
        f"val={len(val_idx):,}  "
        f"test={len(test_idx):,}"
    )
    return train_idx, val_idx, test_idx


# ──────────────────────────────────────────────────────────────────────────────
# TRAINING
# ──────────────────────────────────────────────────────────────────────────────
def train(args: argparse.Namespace) -> None:
    result = configure_gpu()
    if isinstance(result, tuple):
        device, amp_dtype = result
    else:
        device    = result
        amp_dtype = torch.float16

    use_amp = device.type == "cuda"

    print(f"\n{'='*68}")
    print(f"  TypeNet — Workstation training  (RTX 6000 Pro Blackwell)")
    print(f"  Data        : {args.data}")
    print(f"  Output      : {args.out}")
    print(f"  Epochs      : {args.epochs}  |  Batch : {args.batch}  |  LR : {args.lr}")
    print(f"  AMP         : {'yes (' + str(amp_dtype) + ')' if use_amp else 'no'}")
    print(f"  torch.compile: {'yes' if args.compile else 'no'}")
    print(f"  Workers     : {args.workers}")
    print(f"{'='*68}\n")

    # ── Ensure HDF5 exists (download if needed) ───────────────────────────────
    download_h5_if_missing(args.data)

    # ── Splits ────────────────────────────────────────────────────────────────
    train_idx, val_idx, test_idx = make_user_splits(
        args.data, TRAIN_RATIO, VAL_RATIO, SPLIT_SEED
    )

    out_path      = Path(args.out)
    splits_dir    = out_path.parent
    splits_dir.mkdir(parents=True, exist_ok=True)

    np.save(splits_dir / "split_train.npy", train_idx)
    np.save(splits_dir / "split_val.npy",   val_idx)
    np.save(splits_dir / "split_test.npy",  test_idx)
    print(f"Splits saved to {splits_dir}\n")

    # ── Load sequences once, share between train + val ────────────────────────
    print("Loading sequences into RAM (shared by train + val) …")
    t0 = time.perf_counter()
    with h5py.File(str(args.data), "r") as hf:
        shared_seqs = hf["sequences"][:]          # (N, SEQ_LEN, 5) float32
    print(
        f"  ✅  {shared_seqs.shape[0]:,} sequences  "
        f"({shared_seqs.nbytes / 1e9:.2f} GB)  "
        f"in {time.perf_counter() - t0:.1f}s\n"
    )

    # ── Datasets & loaders ────────────────────────────────────────────────────
    num_workers = args.workers

    print("Building train dataset:")
    train_ds = RamTripletDataset(
        args.data,
        user_indices      = train_idx,
        triplets_per_user = args.triplets_per_user,
        sequences         = shared_seqs,
    )
    print("Building val dataset:")
    val_ds = RamTripletDataset(
        args.data,
        user_indices      = val_idx,
        triplets_per_user = args.triplets_per_user,
        sequences         = shared_seqs,
    )

    loader_kwargs = dict(
        batch_size         = args.batch,
        num_workers        = num_workers,
        pin_memory         = use_amp,
        persistent_workers = (num_workers > 0),
        prefetch_factor    = 4 if num_workers > 0 else None,
    )
    train_loader = DataLoader(train_ds, shuffle=True,  **loader_kwargs)
    val_loader   = DataLoader(val_ds,   shuffle=False, **loader_kwargs)

    print(
        f"\nTrain batches/epoch : {len(train_loader):,}  "
        f" Val batches/epoch : {len(val_loader):,}\n"
    )

    # ── Model, loss, optimiser ────────────────────────────────────────────────
    model     = TypeNet().to(device)
    criterion = TripletLoss(margin=args.margin)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=args.lr * 0.01
    )
    scaler = torch.cuda.amp.GradScaler(enabled=use_amp)

    # torch.compile — PyTorch 2.x; wraps forward pass for Triton kernel fusion
    if args.compile:
        try:
            print("Compiling model with torch.compile … (first epoch will be slower)")
            model = torch.compile(model)
            print("torch.compile ✅\n")
        except Exception as e:
            print(f"torch.compile skipped: {e}\n")

    # ── Resume from checkpoint ────────────────────────────────────────────────
    ckpt_path     = out_path.with_suffix(".ckpt.pth")
    start_epoch   = 0
    best_val_loss = float("inf")
    train_history: list[float] = []
    val_history:   list[float] = []

    if args.resume and ckpt_path.exists():
        print(f"Loading checkpoint: {ckpt_path}")
        ckpt = torch.load(ckpt_path, map_location=device)
        model.load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        scheduler.load_state_dict(ckpt["scheduler"])
        if "scaler" in ckpt:
            scaler.load_state_dict(ckpt["scaler"])
        start_epoch   = ckpt["epoch"]
        best_val_loss = ckpt.get("best_val_loss", best_val_loss)
        train_history = ckpt.get("train_history", [])
        val_history   = ckpt.get("val_history",   [])
        print(f"Resumed from epoch {start_epoch}  best_val_loss={best_val_loss:.4f}\n")
    else:
        print("No checkpoint found — starting fresh.\n")

    # ── Metrics output paths ─────────────────────────────────────────────────
    csv_path  = out_path.with_suffix(".training_log.csv")
    json_path = out_path.with_suffix(".results.json")

    # Write CSV header (append mode so resume doesn't erase previous rows)
    csv_existed = csv_path.exists() and start_epoch > 0
    csv_file  = csv_path.open("a", newline="")
    csv_writer = csv.writer(csv_file)
    if not csv_existed:
        csv_writer.writerow(["epoch", "train_loss", "val_loss", "lr", "epoch_time_s", "is_best"])
        csv_file.flush()

    # ── Training loop ─────────────────────────────────────────────────────────
    header = f"{'Epoch':>6}  {'Train':>10}  {'Val':>10}  {'LR':>10}  {'Time':>7}"
    print("─" * len(header))
    print(header)
    print("─" * len(header))

    training_wall_start = time.perf_counter()

    for epoch in range(start_epoch, args.epochs):
        epoch_t0 = time.perf_counter()

        # ── Train pass ────────────────────────────────────────────────────────
        model.train()
        total_train = 0.0

        bar = tqdm(
            train_loader,
            desc  = f"Epoch {epoch+1:>3}/{args.epochs}  train",
            leave = False,
            dynamic_ncols = True,
        )
        for anchor, pos, neg in bar:
            anchor = anchor.to(device, non_blocking=True)
            pos    = pos.to(device,    non_blocking=True)
            neg    = neg.to(device,    non_blocking=True)

            optimizer.zero_grad(set_to_none=True)

            with torch.autocast(device_type="cuda", dtype=amp_dtype, enabled=use_amp):
                e_a, e_p, e_n = model(anchor, pos, neg)
                loss = criterion(e_a, e_p, e_n)

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            scaler.step(optimizer)
            scaler.update()

            total_train += loss.item()
            bar.set_postfix(loss=f"{loss.item():.4f}")

        # ── Validation pass ───────────────────────────────────────────────────
        model.eval()
        total_val = 0.0
        with torch.no_grad():
            for anchor, pos, neg in tqdm(
                val_loader,
                desc  = f"Epoch {epoch+1:>3}/{args.epochs}  val  ",
                leave = False,
                dynamic_ncols = True,
            ):
                anchor = anchor.to(device, non_blocking=True)
                pos    = pos.to(device,    non_blocking=True)
                neg    = neg.to(device,    non_blocking=True)

                with torch.autocast(device_type="cuda", dtype=amp_dtype, enabled=use_amp):
                    e_a, e_p, e_n = model(anchor, pos, neg)
                    total_val += criterion(e_a, e_p, e_n).item()

        scheduler.step()

        avg_train = total_train / len(train_loader)
        avg_val   = total_val   / len(val_loader)
        elapsed   = time.perf_counter() - epoch_t0
        lr_now    = scheduler.get_last_lr()[0]

        train_history.append(avg_train)
        val_history.append(avg_val)

        is_best = avg_val < best_val_loss
        marker  = "  ← best" if is_best else ""
        print(
            f"{epoch+1:>6}  {avg_train:>10.4f}  {avg_val:>10.4f}  "
            f"{lr_now:>10.6f}  {elapsed:>5.0f}s{marker}"
        )

        # Write CSV row
        csv_writer.writerow([epoch + 1, f"{avg_train:.6f}", f"{avg_val:.6f}",
                             f"{lr_now:.8f}", f"{elapsed:.1f}", int(is_best)])
        csv_file.flush()

        # Save best model (judged on val loss)
        if is_best:
            best_val_loss = avg_val
            torch.save(model.state_dict(), out_path)

        # Periodic checkpoint for resuming
        if (epoch + 1) % CHECKPOINT_EVERY == 0:
            torch.save(
                {
                    "epoch":         epoch + 1,
                    "model":         model.state_dict(),
                    "optimizer":     optimizer.state_dict(),
                    "scheduler":     scheduler.state_dict(),
                    "scaler":        scaler.state_dict(),
                    "best_val_loss": best_val_loss,
                    "train_history": train_history,
                    "val_history":   val_history,
                },
                ckpt_path,
            )
            print(f"  ✓ Checkpoint → {ckpt_path}")

    csv_file.close()
    total_wall_time = time.perf_counter() - training_wall_start

    # ── Final summary ─────────────────────────────────────────────────────────
    best_epoch = val_history.index(min(val_history)) + 1
    print(f"\nTraining complete.  Best val loss : {best_val_loss:.4f}  (epoch {best_epoch})")
    print(f"Best model saved  : {out_path}")
    print(f"Training log CSV  : {csv_path}")

    _save_loss_curves(train_history, val_history, out_path)
    test_results = _run_test_sanity(args.data, test_idx, model, device, amp_dtype, use_amp)

    # ── Save JSON results ─────────────────────────────────────────────────────
    gpu_info = {}
    if torch.cuda.is_available():
        g = torch.cuda.get_device_properties(0)
        gpu_info = {"name": g.name, "vram_gb": g.total_memory // 1024**3,
                    "compute": f"sm_{g.major}{g.minor}"}

    results = {
        "run": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "total_training_time_s": round(total_wall_time, 1),
            "total_training_time_human": _fmt_duration(total_wall_time),
            "gpu": gpu_info,
        },
        "hyperparameters": {
            "epochs":            args.epochs,
            "batch_size":        args.batch,
            "learning_rate":     args.lr,
            "margin":            args.margin,
            "seq_len":           SEQ_LEN,
            "triplets_per_user": args.triplets_per_user,
            "amp_dtype":         str(amp_dtype) if use_amp else "disabled",
            "torch_compile":     args.compile,
            "workers":           args.workers,
            "train_ratio":       TRAIN_RATIO,
            "val_ratio":         VAL_RATIO,
            "test_ratio":        TEST_RATIO,
            "split_seed":        SPLIT_SEED,
        },
        "split": {
            "train_users": int(len(train_idx)),
            "val_users":   int(len(val_idx)),
            "test_users":  int(len(test_idx)),
        },
        "training": {
            "best_val_loss":  round(best_val_loss, 6),
            "best_epoch":     best_epoch,
            "final_train_loss": round(train_history[-1], 6) if train_history else None,
            "final_val_loss":   round(val_history[-1],   6) if val_history   else None,
            "train_loss_history": [round(v, 6) for v in train_history],
            "val_loss_history":   [round(v, 6) for v in val_history],
        },
        "test_sanity": test_results,
        "output_files": {
            "best_model":   str(out_path),
            "checkpoint":   str(ckpt_path),
            "training_log": str(csv_path),
            "results_json": str(json_path),
            "loss_curves":  str(out_path.with_suffix(".loss_curves.png")),
        },
    }

    json_path.write_text(json.dumps(results, indent=2))
    print(f"Results JSON      : {json_path}")


# ──────────────────────────────────────────────────────────────────────────────
# POST-TRAINING UTILITIES
# ──────────────────────────────────────────────────────────────────────────────
def _fmt_duration(seconds: float) -> str:
    """Human-readable duration string, e.g. '1h 23m 45s'."""
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    parts = []
    if h:
        parts.append(f"{h}h")
    if m or h:
        parts.append(f"{m}m")
    parts.append(f"{sec}s")
    return " ".join(parts)


def _save_loss_curves(
    train_history: list[float],
    val_history: list[float],
    model_path: Path,
) -> None:
    """Save train/val loss curve as a PNG next to the model file."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(11, 4))
        epochs  = range(1, len(train_history) + 1)
        ax.plot(epochs, train_history, label="Train (80%)",      marker="o", ms=3)
        ax.plot(epochs, val_history,   label="Validation (10%)", marker="s", ms=3)

        best_ep = val_history.index(min(val_history)) + 1
        ax.axvline(best_ep, color="red", linestyle="--", alpha=0.5,
                   label=f"Best val epoch {best_ep}")

        ax.set_xlabel("Epoch")
        ax.set_ylabel("Avg Triplet Loss")
        ax.set_title(
            "TypeNet Training & Validation Loss — Full Aalto Dataset\n"
            "(80% train / 10% val / 10% test — per-user split)"
        )
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        png_path = model_path.with_suffix(".loss_curves.png")
        plt.savefig(png_path, dpi=150)
        plt.close()
        print(f"Loss curves saved : {png_path}")
    except ImportError:
        print("matplotlib not installed — skipping loss curve plot.")
    except Exception as e:
        print(f"Could not save loss curves: {e}")


def _run_test_sanity(
    h5_path: str,
    test_idx: np.ndarray,
    model: nn.Module,
    device: torch.device,
    amp_dtype: torch.dtype,
    use_amp: bool,
    n_check: int = 50,
) -> dict:
    """
    Quick intra-user vs inter-user distance check on the held-out test set.
    Prints the separation ratio and returns a dict for JSON serialisation.
    """
    print("\n── Test-set sanity check (10% held-out users) ──")
    model.eval()

    n_check = min(n_check, len(test_idx))
    intra_dists, inter_dists = [], []

    with h5py.File(str(h5_path), "r") as hf:
        idx_map = hf["index_map"][:]
        seqs_ds = hf["sequences"]

        with torch.no_grad():
            for i in range(n_check):
                u              = int(test_idx[i])
                start, end     = idx_map[u]
                if end - start < 2:
                    continue

                s1 = torch.from_numpy(seqs_ds[int(start)    ][None].astype(np.float32)).to(device)
                s2 = torch.from_numpy(seqs_ds[int(start) + 1][None].astype(np.float32)).to(device)

                with torch.autocast(device_type="cuda", dtype=amp_dtype, enabled=use_amp):
                    e1 = model.forward_one(s1)
                    e2 = model.forward_one(s2)

                intra_dists.append((e1 - e2).pow(2).sum().item())

                other   = int(test_idx[(i + 1) % n_check])
                o_start = int(idx_map[other, 0])
                eo      = model.forward_one(
                    torch.from_numpy(seqs_ds[o_start][None].astype(np.float32)).to(device)
                )
                inter_dists.append((e1 - eo).pow(2).sum().item())

    if not intra_dists:
        print("  Not enough test sequences to compute distances.")
        return {"error": "insufficient_test_sequences"}

    avg_intra = sum(intra_dists) / len(intra_dists)
    avg_inter = sum(inter_dists) / len(inter_dists)
    ratio     = avg_inter / avg_intra if avg_intra > 0 else float("inf")
    print(f"  Avg intra-user dist (same person)      : {avg_intra:.4f}")
    print(f"  Avg inter-user dist (different person) : {avg_inter:.4f}")
    print(f"  Separation ratio   (inter/intra)       : {ratio:.2f}x")
    print("  (higher ratio = better discrimination)")

    return {
        "n_users_checked":    n_check,
        "avg_intra_user_dist": round(avg_intra, 6),
        "avg_inter_user_dist": round(avg_inter, 6),
        "separation_ratio":    round(ratio, 4),
        "all_intra_dists":     [round(v, 6) for v in intra_dists],
        "all_inter_dists":     [round(v, 6) for v in inter_dists],
    }


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────
def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="TypeNet workstation training — RTX 6000 Pro Blackwell optimised"
    )
    p.add_argument(
        "--data",
        default=str(Path(__file__).parent / "aalto_full.h5"),
        help="Path to aalto_full.h5.  If the file is missing it will be downloaded "
             "automatically from Google Drive (requires: pip install gdown).",
    )
    p.add_argument(
        "--out", default="models/typenet_pretrained.pth",
        help="Output path for the best model weights (.pth)",
    )
    p.add_argument("--epochs",            type=int,   default=EPOCHS)
    p.add_argument("--batch",             type=int,   default=BATCH_SIZE,
                   help="Batch size (default 512 — matches Colab for best accuracy; "
                        "scale LR proportionally if increasing: e.g. 1024→lr 0.010, 2048→lr 0.020)")
    p.add_argument("--lr",                type=float, default=LEARNING_RATE)
    p.add_argument("--margin",            type=float, default=MARGIN)
    p.add_argument("--triplets_per_user", type=int,   default=TRIPLETS_PER_USER)
    p.add_argument(
        "--workers", type=int,
        default=min(8, max(1, multiprocessing.cpu_count() // 2)),
        help="DataLoader workers (default: half the CPU cores, max 8)",
    )
    p.add_argument(
        "--compile", action="store_true", default=True,
        help="Use torch.compile() for graph fusion (PyTorch 2.x, default on)",
    )
    p.add_argument(
        "--no-compile", dest="compile", action="store_false",
        help="Disable torch.compile()",
    )
    p.add_argument(
        "--resume", action="store_true",
        help="Resume training from checkpoint if available",
    )
    return p.parse_args()


if __name__ == "__main__":
    train(_parse_args())
