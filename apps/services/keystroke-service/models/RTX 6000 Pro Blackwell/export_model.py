import torch
from train_workstation import TypeNet

model_path = "/root/typenet_pretrained.pth"
export_path = "typenet_final.pth"

state_dict = torch.load(model_path, map_location="cpu")

model = TypeNet()
model.load_state_dict(state_dict)

torch.save(model.state_dict(), export_path)

print("Model exported successfully ->", export_path)