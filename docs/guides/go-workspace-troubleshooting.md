# Go Workspace Troubleshooting Guide

This document provides solutions for resolving Go language server (gopls) workspace warnings and build issues in the Gradeloop project.

## Common Issues

### LSP Warning: "No active builds contain [file]: consider opening a new workspace folder containing it"

This warning indicates that the Go language server cannot find the module containing the file. This is a workspace configuration issue, not a code problem.

## Solutions

### Solution 1: Restart Go Language Server

The quickest fix is to restart your Go language server:

**VS Code:**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Go: Restart Language Server"
3. Select and run the command

**Vim/Neovim with vim-go:**
```vim
:GoRestartLSP
```

**Other editors:**
Kill and restart the `gopls` process.

### Solution 2: Fix Go Workspace Configuration

Run the workspace fix script:

```bash
./scripts/fix-go-workspace.sh
```

Or manually fix the workspace:

1. **Ensure go.work file exists** in project root:

```go
go 1.25.6

use (
    ./apps/services/iam-service
    ./shared/libs/go
    ./shared/libs/go/logger
    ./shared/libs/go/middleware
    ./shared/libs/go/secrets
    ./shared/libs/go/errors
)
```

2. **Synchronize workspace:**
```bash
go work sync
```

### Solution 3: Open Correct Workspace Folder

The LSP warning suggests opening the correct workspace folder. You have two options:

**Option A: Open Project Root (Recommended)**
Open `gradeloop-core-v2/` as your workspace root. This allows the language server to see all modules.

**Option B: Open Service Folder**
If you only work on the IAM service, open `gradeloop-core-v2/apps/services/iam-service/` as your workspace root.

### Solution 4: Clean Module Cache

If workspace sync doesn't work, clean the module cache:

```bash
go clean -modcache
go work sync
```

### Solution 5: Check Module Dependencies

Verify all modules can be resolved:

```bash
# From project root
go list -m all

# Test IAM service build
cd apps/services/iam-service
go build ./cmd/main.go
```

## Module Structure

The Gradeloop project uses Go workspaces with the following structure:

```
gradeloop-core-v2/
├── go.work                              # Workspace configuration
├── go.work.sum                          # Workspace dependencies
├── apps/
│   └── services/
│       └── iam-service/
│           ├── go.mod                   # IAM service module
│           └── go.sum                   # IAM service dependencies
└── shared/
    └── libs/
        └── go/
            ├── go.mod                   # Shared Go module
            ├── logger/
            │   └── go.mod               # Logger module
            ├── middleware/
            │   └── go.mod               # Middleware module
            ├── secrets/
            │   └── go.mod               # Secrets module
            └── errors/
                └── go.mod               # Errors module
```

## Editor-Specific Configuration

### VS Code

Create or update `.vscode/settings.json`:

```json
{
    "go.toolsManagement.checkForUpdates": "local",
    "go.useLanguageServer": true,
    "go.gopath": "",
    "go.goroot": "",
    "go.buildOnSave": "off",
    "go.lintOnSave": "package",
    "go.vetOnSave": "package",
    "go.formatTool": "gofmt",
    "go.lintTool": "golint",
    "go.vetFlags": [],
    "gopls": {
        "experimentalWorkspaceModule": true,
        "usePlaceholders": true
    }
}
```

### Vim/Neovim

For vim-go users, add to your `.vimrc` or `init.vim`:

```vim
let g:go_gopls_enabled = 1
let g:go_gopls_options = ['-remote=auto']
```

## Troubleshooting Steps

### Step 1: Verify File Structure

Ensure all required files exist:

```bash
# Check workspace file
ls -la go.work

# Check all module files
find . -name "go.mod" -type f
```

Expected output:
- `go.work`
- `apps/services/iam-service/go.mod`
- `shared/libs/go/go.mod`
- `shared/libs/go/logger/go.mod`
- `shared/libs/go/middleware/go.mod`
- `shared/libs/go/secrets/go.mod`
- `shared/libs/go/errors/go.mod`

### Step 2: Test Module Resolution

```bash
# From project root
go list -m all | grep gradeloop-core-v2

# Expected output should include all local modules
```

### Step 3: Verify Build

```bash
# Test IAM service builds
cd apps/services/iam-service
go build -v ./cmd/main.go
```

### Step 4: Check Import Paths

Verify import paths in Go files match module names in `go.mod`:

```go
// In IAM service files, imports should look like:
import (
    "github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
    "github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
)
```

## Common Errors and Solutions

### Error: "module github.com/4YRG/gradeloop-core-v2/... not found"

**Cause:** Workspace not properly configured or modules not in workspace.

**Solution:**
1. Check `go.work` includes all modules
2. Run `go work sync`
3. Restart language server

### Error: "cannot find module providing package"

**Cause:** Missing dependency or incorrect import path.

**Solution:**
1. Check `go.mod` has correct dependencies
2. Run `go mod tidy` in the service directory
3. Verify import paths match module structure

### Error: "build constraints exclude all Go files"

**Cause:** No Go files found or wrong directory.

**Solution:**
1. Verify you're in correct directory
2. Check Go files exist and have correct extensions
3. Verify build tags if used

## Verification

After applying fixes, verify everything works:

```bash
# 1. Run workspace fix script
./scripts/fix-go-workspace.sh

# 2. Test health endpoint
curl http://localhost:8000/api/iam/health

# 3. Run comprehensive tests
./scripts/test-gateway-auth.sh
```

## When to Ignore LSP Warnings

The LSP warnings are cosmetic if:

1. ✅ Code compiles successfully
2. ✅ Tests pass
3. ✅ Application runs correctly
4. ✅ Docker build succeeds

The GRADLOOP-41 implementation is functionally complete regardless of LSP warnings.

## Getting Help

If issues persist:

1. Check Go version: `go version` (should be 1.25.6+)
2. Check gopls version: `gopls version`
3. Review editor logs for specific errors
4. Try opening just the IAM service folder as workspace
5. Consider using `go run` instead of relying on LSP for development

Remember: LSP warnings are development convenience issues, not deployment blockers. The code is production-ready even with workspace warnings.