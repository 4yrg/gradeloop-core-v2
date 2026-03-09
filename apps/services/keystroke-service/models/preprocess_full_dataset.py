"""
preprocess_full_dataset.py
--------------------------
Converts the raw Aalto 136M-Keystrokes dataset (Keystrokes.zip) into a compact
HDF5 file ready for TypeNet training on the FULL dataset.

Usage
-----
    python models/preprocess_full_dataset.py \
        --zip  dataset/Keystrokes.zip \
        --out  models/aalto_full.h5 \
        [--seq_len 70] [--stride 35] [--min_seqs 5] [--max_seqs 50]

Output HDF5 layout
------------------
    /sequences   (N_total, SEQ_LEN, 5)  float32   chunked=(2048, SEQ_LEN, 5)
    /labels      (N_total,)             int32     consecutive user index
    /index_map   (N_users, 2)           int64     [seq_start, seq_end) per user
    /orig_ids    (N_users,)             int32     original PARTICIPANT_ID
    attrs: n_users, n_sequences, seq_len, stride, min_seqs, max_seqs

TypeNet features (per keystroke i, i >= 1 within a sentence)
-------------------------------------------------------------
    0: HL  – hold latency       = RELEASE_TIME[i] – PRESS_TIME[i]
    1: IL  – inter-key latency  = PRESS_TIME[i]   – PRESS_TIME[i-1]   (DD)
    2: PL  – press latency      = PRESS_TIME[i]   – RELEASE_TIME[i-1] (UD)
    3: RL  – release latency    = RELEASE_TIME[i] – RELEASE_TIME[i-1] (UU)
    4: KC  – key code           = KEYCODE / 256.0

All time features are clipped and min-max normalised to [0, 1] using the
constants at the top of the file so no second pass is needed.
"""

import argparse
import sys
import zipfile
from pathlib import Path

import h5py
import numpy as np

# ──────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────
SEQ_LEN   = 70       # keystrokes per sequence (TypeNet optimal)
STRIDE    = 35       # sliding-window stride (50 % overlap → 2× more samples)
MIN_SEQS  = 5        # skip users with fewer than this many valid sequences
MAX_SEQS  = 50       # cap per-user sequences (class balance for triplet loss)

# Normalisation: clip raw ms values then scale to [0, 1]
# Keys: feature index → (clip_min, clip_max)
CLIP = {
    "HL": (0,   1000),   # hold time: 0 – 1000 ms
    "IL": (-200, 2000),  # inter-key:  can be negative briefly
    "PL": (-500, 2000),  # up-down:    can be negative (key overlap)
    "RL": (-500, 2000),  # up-up:      same
}

CHUNK_WRITE = 4096   # sequences to buffer before writing to HDF5


# ──────────────────────────────────────────────────────────────
# FEATURE COMPUTATION
# ──────────────────────────────────────────────────────────────
def _norm(value: float, lo: float, hi: float) -> float:
    """Clip + linear scale to [0, 1]."""
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def extract_sequences(lines: list[bytes], seq_len: int, stride: int) -> list[np.ndarray]:
    """
    Parse one user's raw keystroke lines, group by sentence, compute TypeNet
    features, then emit sliding windows of length `seq_len`.

    Parameters
    ----------
    lines  : raw bytes lines from the .txt file (header line already included)
    seq_len: window length
    stride : sliding-window step

    Returns
    -------
    List of float32 arrays each shaped (seq_len, 5).
    """
    # ── 1. Parse rows ──────────────────────────────────────────
    sentences: dict[str, list[tuple]] = {}  # section_id → [(press, release, keycode)]

    for raw in lines:
        try:
            row = raw.decode("utf-8", errors="replace").rstrip("\n").split("\t")
        except Exception:
            continue
        if len(row) < 9:
            continue
        if row[0].strip() == "PARTICIPANT_ID":
            continue  # header row

        try:
            section_id   = row[1].strip()
            press_time   = float(row[5].strip())
            release_time = float(row[6].strip())
            keycode      = int(row[8].strip())
        except (ValueError, IndexError):
            continue

        if press_time <= 0 or release_time <= 0:
            continue
        if release_time < press_time:
            continue  # corrupt row

        sentences.setdefault(section_id, []).append((press_time, release_time, keycode))

    # ── 2. Build per-sentence feature arrays ───────────────────
    all_sequences: list[np.ndarray] = []

    for section_id, keystrokes in sentences.items():
        # Sort by press time (just in case they're out of order)
        keystrokes.sort(key=lambda x: x[0])
        n = len(keystrokes)

        if n < seq_len:
            continue  # sentence too short for even one window

        # Compute 5 TypeNet features for every keystroke i
        feat = np.zeros((n, 5), dtype=np.float32)
        for i, (press_i, release_i, kc_i) in enumerate(keystrokes):
            hl = release_i - press_i
            feat[i, 0] = _norm(hl, *CLIP["HL"])
            feat[i, 4] = float(kc_i) / 256.0  # KeyCode always defined

            if i > 0:
                press_prev, release_prev, _ = keystrokes[i - 1]
                il = press_i   - press_prev
                pl = press_i   - release_prev
                rl = release_i - release_prev
                feat[i, 1] = _norm(il, *CLIP["IL"])
                feat[i, 2] = _norm(pl, *CLIP["PL"])
                feat[i, 3] = _norm(rl, *CLIP["RL"])
            # else: feat[i, 1..3] stays 0 (first key in sentence)

        # Sliding window extraction
        start = 0
        while start + seq_len <= n:
            all_sequences.append(feat[start : start + seq_len].copy())
            start += stride

    return all_sequences


# ──────────────────────────────────────────────────────────────
# MAIN PREPROCESSING PIPELINE
# ──────────────────────────────────────────────────────────────
def preprocess(
    zip_path: Path,
    out_path: Path,
    seq_len: int   = SEQ_LEN,
    stride: int    = STRIDE,
    min_seqs: int  = MIN_SEQS,
    max_seqs: int  = MAX_SEQS,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Reading  : {zip_path}")
    print(f"Output   : {out_path}")
    print(f"seq_len={seq_len}  stride={stride}  min_seqs={min_seqs}  max_seqs={max_seqs}")
    print()

    # Discover all per-user keystroke files inside the zip
    with zipfile.ZipFile(zip_path, "r") as zf:
        user_entries = sorted(
            e for e in zf.namelist()
            if e.endswith("_keystrokes.txt") and "metadata" not in e
        )
    total_files = len(user_entries)
    print(f"Found {total_files:,} user keystroke files in ZIP.\n")

    # ── Open HDF5 for incremental writing ──────────────────────
    with zipfile.ZipFile(zip_path, "r") as zf, \
         h5py.File(out_path, "w") as hf:

        # Resizable datasets
        seq_ds  = hf.create_dataset(
            "sequences",
            shape=(0, seq_len, 5),
            maxshape=(None, seq_len, 5),
            dtype="float32",
            chunks=(min(CHUNK_WRITE, 2048), seq_len, 5),
            compression="lzf",          # fast, lightweight compression
        )
        lbl_ds  = hf.create_dataset(
            "labels",
            shape=(0,),
            maxshape=(None,),
            dtype="int32",
            chunks=(min(CHUNK_WRITE * 4, 8192),),
            compression="lzf",
        )

        # Buffers for batch writes
        seq_buf:  list[np.ndarray] = []
        lbl_buf:  list[int]        = []

        # Metadata accumulated per user
        orig_ids:   list[int]        = []
        index_map:  list[tuple[int, int]] = []
        total_seqs = 0      # running count of sequences written so far
        user_idx   = 0      # consecutive user counter

        def flush():
            """Write buffered sequences + labels to HDF5."""
            nonlocal seq_buf, lbl_buf
            if not seq_buf:
                return
            batch      = np.stack(seq_buf, axis=0)
            old_n      = seq_ds.shape[0]
            new_n      = old_n + len(batch)
            seq_ds.resize(new_n, axis=0)
            lbl_ds.resize(new_n, axis=0)
            seq_ds[old_n:new_n] = batch
            lbl_ds[old_n:new_n] = np.array(lbl_buf, dtype=np.int32)
            seq_buf = []
            lbl_buf = []

        # ── Iterate over user files ─────────────────────────────
        for file_num, entry in enumerate(user_entries, 1):
            # Progress
            if file_num % 5000 == 0 or file_num == 1 or file_num == total_files:
                pct = 100 * file_num / total_files
                print(
                    f"  [{file_num:>6}/{total_files}  {pct:5.1f}%]  "
                    f"valid users so far: {user_idx:,}  "
                    f"sequences: {total_seqs:,}",
                    flush=True,
                )

            try:
                raw_bytes = zf.read(entry)
            except Exception as e:
                print(f"  WARN: could not read {entry}: {e}", file=sys.stderr)
                continue

            lines = raw_bytes.splitlines(keepends=False)
            seqs  = extract_sequences(lines, seq_len, stride)

            if len(seqs) < min_seqs:
                continue  # not enough data for this user

            # Cap to max_seqs (random sample for balance)
            if len(seqs) > max_seqs:
                idxs = np.random.choice(len(seqs), max_seqs, replace=False)
                seqs = [seqs[i] for i in sorted(idxs)]

            # Infer original participant ID from filename  e.g. "100001_keystrokes.txt"
            try:
                orig_id = int(Path(entry).name.split("_")[0])
            except ValueError:
                orig_id = -1

            n_seqs = len(seqs)
            seq_start = total_seqs
            seq_end   = total_seqs + n_seqs

            orig_ids.append(orig_id)
            index_map.append((seq_start, seq_end))
            total_seqs += n_seqs

            for s in seqs:
                seq_buf.append(s)
                lbl_buf.append(user_idx)

            user_idx += 1

            if len(seq_buf) >= CHUNK_WRITE:
                flush()

        flush()  # final write

        # ── Store index metadata ───────────────────────────────
        hf.create_dataset("orig_ids",  data=np.array(orig_ids,  dtype=np.int32))
        hf.create_dataset("index_map", data=np.array(index_map, dtype=np.int64))

        # Root-level attributes
        hf.attrs["n_users"]     = user_idx
        hf.attrs["n_sequences"] = total_seqs
        hf.attrs["seq_len"]     = seq_len
        hf.attrs["stride"]      = stride
        hf.attrs["min_seqs"]    = min_seqs
        hf.attrs["max_seqs"]    = max_seqs

    print()
    print("── Preprocessing complete ─────────────────────────────────")
    print(f"  Valid users  : {user_idx:,}")
    print(f"  Total seqs   : {total_seqs:,}")
    print(f"  Output file  : {out_path}  ({out_path.stat().st_size / 1e9:.2f} GB)")


# ──────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────
def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Preprocess Aalto 136M Keystrokes for TypeNet")
    p.add_argument("--zip",      type=Path, default=Path("dataset/Keystrokes.zip"),
                   help="Path to Keystrokes.zip")
    p.add_argument("--out",      type=Path, default=Path("models/aalto_full.h5"),
                   help="Output HDF5 path")
    p.add_argument("--seq_len",  type=int,  default=SEQ_LEN,  help="Sequence length (default 70)")
    p.add_argument("--stride",   type=int,  default=STRIDE,   help="Sliding-window stride (default 35)")
    p.add_argument("--min_seqs", type=int,  default=MIN_SEQS, help="Min sequences per user (default 5)")
    p.add_argument("--max_seqs", type=int,  default=MAX_SEQS, help="Max sequences per user (default 50)")
    p.add_argument("--seed",     type=int,  default=42,       help="Random seed")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    np.random.seed(args.seed)
    preprocess(
        zip_path = args.zip,
        out_path = args.out,
        seq_len  = args.seq_len,
        stride   = args.stride,
        min_seqs = args.min_seqs,
        max_seqs = args.max_seqs,
    )
