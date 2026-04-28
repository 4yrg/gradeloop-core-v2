# evaluate_and_export.py
import os

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from tqdm.auto import tqdm
from train_workstation import TypeNet  # your model class

# ------------------------------
# CONFIG
# ------------------------------
MODEL_PATH = "/workspace/typenet_final.pth"
H5_PATH = "/workspace/aalto_full.h5"
OUTPUT_DIR = "/workspace/evaluation_results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

INPUT_SIZE = 5
SEQ_LEN = 30
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TRIPLETS_PER_USER = 10
EVAL_PROP = 0.1  # 10% of users

# ------------------------------
# LOAD MODEL
# ------------------------------
model = TypeNet()
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True))
model.to(DEVICE)
model.eval()

# ------------------------------
# LOAD DATA
# ------------------------------
with h5py.File(H5_PATH, "r") as hf:
    sequences = hf["sequences"][:]
    index_map = hf["index_map"][:]
    n_users = len(index_map)

num_eval_users = max(1, int(n_users * EVAL_PROP))
rng = np.random.default_rng(42)
eval_users = rng.choice(n_users, size=num_eval_users, replace=False)

# ------------------------------
# EVALUATE TRIPLETS
# ------------------------------
correct = 0
total = 0
y_true_all = []
y_pred_all = []

with torch.no_grad():
    for u in tqdm(eval_users, desc="Evaluating users"):
        start, end = index_map[u]
        user_seqs = sequences[start:end]
        if len(user_seqs) < 2:
            continue

        for _ in range(TRIPLETS_PER_USER):
            # Anchor and positive from same user
            a_idx, p_idx = np.random.choice(len(user_seqs), size=2, replace=False)
            a_seq = torch.tensor(user_seqs[a_idx], dtype=torch.float32).unsqueeze(0).to(DEVICE)
            p_seq = torch.tensor(user_seqs[p_idx], dtype=torch.float32).unsqueeze(0).to(DEVICE)

            # Negative from different user
            neg_user = u
            while neg_user == u:
                neg_user = rng.integers(n_users)
            n_start, n_end = index_map[neg_user]
            n_idx = np.random.randint(n_start, n_end)
            n_seq = torch.tensor(sequences[n_idx], dtype=torch.float32).unsqueeze(0).to(DEVICE)

            # Compute embeddings
            a_emb = model.forward_one(a_seq)
            p_emb = model.forward_one(p_seq)
            n_emb = model.forward_one(n_seq)

            # Compute distances
            d_pos = torch.norm(a_emb - p_emb, p=2)
            d_neg = torch.norm(a_emb - n_emb, p=2)

            # Triplet accuracy
            if d_pos < d_neg:
                correct += 1
                y_pred_all.append(1)
            else:
                y_pred_all.append(0)
            total += 1
            y_true_all.append(1)  # positive distance is "correct"

# ------------------------------
# METRICS
# ------------------------------
accuracy = accuracy_score(y_true_all, y_pred_all)
precision = precision_score(y_true_all, y_pred_all, average="binary", zero_division=0)
recall = recall_score(y_true_all, y_pred_all, average="binary", zero_division=0)
f1 = f1_score(y_true_all, y_pred_all, average="binary", zero_division=0)

metrics = {
    "accuracy": accuracy,
    "precision": precision,
    "recall": recall,
    "f1": f1,
    "triplet_accuracy": correct / total if total > 0 else 0,
}

# Save metrics as CSV
metrics_df = pd.DataFrame([metrics])
metrics_csv_path = os.path.join(OUTPUT_DIR, "metrics.csv")
metrics_df.to_csv(metrics_csv_path, index=False)
print(f"Metrics saved to {metrics_csv_path}")

# ------------------------------
# CONFUSION MATRIX
# ------------------------------
cm = confusion_matrix(y_true_all, y_pred_all)
plt.figure(figsize=(5, 4))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=[0, 1], yticklabels=[0, 1])
plt.xlabel("Predicted")
plt.ylabel("True")
plt.title("Triplet Confusion Matrix")
cm_path = os.path.join(OUTPUT_DIR, "confusion_matrix.png")
plt.savefig(cm_path)
plt.close()
print(f"Confusion matrix saved to {cm_path}")

# ------------------------------
# PLOT METRICS BAR CHART
# ------------------------------
plt.figure(figsize=(6, 4))
plt.bar(metrics.keys(), metrics.values(), color="skyblue")
plt.ylim(0, 1)
plt.title("Evaluation Metrics")
for i, v in enumerate(metrics.values()):
    plt.text(i, v + 0.02, f"{v:.2f}", ha="center")
metrics_plot_path = os.path.join(OUTPUT_DIR, "metrics_bar_chart.png")
plt.savefig(metrics_plot_path)
plt.close()
print(f"Metrics bar chart saved to {metrics_plot_path}")

print("Evaluation complete!")
