# Shared Protobuf Definitions

This directory contains the central Protocol Buffer definitions for the GradeLoop V2 ecosystem.

## Directory Structure

- `protos/`: The source of truth for all `.proto` files.
- `gen/`: Generated code for Go and Python. **Do not edit manually.**

## Workflow

We use [Buf](https://buf.build) for linting, breaking change detection, and generation.

### Prerequisites

1.  **Go**: Ensure Go is installed and `$(go env GOPATH)/bin` is in your `PATH`.
2.  **Make**: Ensure `make` is installed.

### Commands

Run these commands from the `shared/protos` directory:

```bash
# Install necessary tools (buf, protoc-gen-go, etc.)
make install-tools

# Lint your proto files
make lint

# Check for breaking changes against main branch
make check-breaking

# Generate code for Go and Python
make generate
```

## Consumption

### Go
Import the generated code directly:
```go
import iamv1 "github.com/4yrg/gradeloop-core-v2/shared/gen/go/iam/v1"
```

### Python
Add the generated code directory to your python path:
```python
sys.path.append("/path/to/gradeloop-core-v2/shared/gen/python")
from iam.v1 import user_service_pb2
```
