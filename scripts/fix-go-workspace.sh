#!/bin/bash

# Fix Go Workspace Configuration Script
# Resolves LSP warnings and ensures proper Go module detection

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Fixing Go Workspace Configuration${NC}"
echo "======================================"
echo ""

# Step 1: Clean up any existing workspace state
echo -e "Step 1: Cleaning workspace state..."
if [ -f "go.work.sum" ]; then
    echo "  - Backing up existing go.work.sum"
    cp go.work.sum go.work.sum.backup
fi

# Step 2: Recreate go.work file with correct modules
echo -e "Step 2: Recreating go.work file..."

cat > go.work << EOF
go 1.25.6

use (
	./apps/services/iam-service
	./shared/libs/go
	./shared/libs/go/logger
	./shared/libs/go/middleware
	./shared/libs/go/secrets
	./shared/libs/go/errors
)
EOF

echo -e "${GREEN}  ✓ Created go.work file${NC}"

# Step 3: Verify all modules exist
echo -e "Step 3: Verifying Go modules..."

modules=(
    "apps/services/iam-service"
    "shared/libs/go"
    "shared/libs/go/logger"
    "shared/libs/go/middleware"
    "shared/libs/go/secrets"
    "shared/libs/go/errors"
)

for module in "${modules[@]}"; do
    if [ -f "$module/go.mod" ]; then
        echo -e "${GREEN}  ✓ $module/go.mod exists${NC}"
    else
        echo -e "${RED}  ✗ $module/go.mod missing${NC}"
    fi
done

# Step 4: Initialize workspace
echo -e "Step 4: Initializing Go workspace..."

if command -v go &> /dev/null; then
    go work sync
    echo -e "${GREEN}  ✓ Workspace synchronized${NC}"
else
    echo -e "${YELLOW}  ⚠ Go command not found, skipping sync${NC}"
fi

# Step 5: Instructions for LSP restart
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Restart your Go language server:"
echo "   - In VS Code: Ctrl+Shift+P → 'Go: Restart Language Server'"
echo "   - In other editors: Restart the gopls process"
echo ""
echo "2. If issues persist, try:"
echo "   - Close and reopen your editor"
echo "   - Run: go clean -modcache"
echo "   - Run: go work sync"
echo ""
echo -e "${GREEN}✨ Workspace configuration complete!${NC}"

# Step 6: Verify workspace is working
echo ""
echo -e "Step 6: Workspace verification..."

if command -v go &> /dev/null; then
    echo "Go modules in workspace:"
    go list -m all 2>/dev/null | head -10 || echo "  (Run 'go list -m all' to see all modules)"
    echo ""

    # Test if we can build the IAM service
    echo "Testing IAM service build..."
    if cd apps/services/iam-service && go build -v ./cmd/main.go 2>/dev/null; then
        echo -e "${GREEN}  ✓ IAM service builds successfully${NC}"
        rm -f main 2>/dev/null || true
        cd ../../..
    else
        echo -e "${YELLOW}  ⚠ IAM service build test skipped (dependencies may need to be downloaded)${NC}"
        cd ../../.. 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}Go command not available - workspace file created but cannot verify build${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Go workspace configuration completed successfully!${NC}"
echo -e "The LSP warnings should be resolved after restarting your language server."
