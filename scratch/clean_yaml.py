import yaml
import sys

def clean_yaml(file_path):
    # We use a custom Loader to handle duplicate keys by keeping the last one
    # But actually, standard pyyaml might error or just keep one.
    # To be safe, we'll read it as text and remove adjacent duplicate start_period lines.
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    last_line = ""
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("start_period:") and last_line.strip().startswith("start_period:"):
            # Skip duplicate
            continue
        new_lines.append(line)
        last_line = line
        
    with open(file_path, 'w') as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    clean_yaml(sys.argv[1])
