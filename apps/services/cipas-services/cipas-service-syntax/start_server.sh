#!/bin/bash
# =============================================================================
# Clone Detection API Server Startup Script
# =============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Clone Detection API Server${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check if virtual environment exists
VENV_PATH="$SCRIPT_DIR/.venv-cipas-syntax"
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${YELLOW}Virtual environment not found. Running setup...${NC}"
    chmod +x scripts/setup_pipeline.sh
    ./scripts/setup_pipeline.sh
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source "$VENV_PATH/bin/activate"

# Check if model exists
MODEL_PATH="$SCRIPT_DIR/data/models/clone_classifier.joblib"
if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${YELLOW}Model not found at $MODEL_PATH${NC}"
    echo "You can train a model using:"
    echo "  python scripts/train_model.py -n 10000"
    echo ""
    echo -e "${YELLOW}Continuing without model (some endpoints will not work)...${NC}"
    echo ""
fi

# Parse arguments
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
RELOAD="${RELOAD:-true}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --no-reload)
            RELOAD="false"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --host HOST        Host to bind to (default: 0.0.0.0)"
            echo "  --port PORT        Port to bind to (default: 8000)"
            echo "  --no-reload        Disable auto-reload"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""
echo -e "${BLUE}Starting server...${NC}"
echo ""
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo -e "  Reload: ${YELLOW}$RELOAD${NC}"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}API Documentation:${NC}"
echo -e "  Swagger UI:  http://localhost:$PORT/docs"
echo -e "  ReDoc:       http://localhost:$PORT/redoc"
echo -e "  OpenAPI:     http://localhost:$PORT/openapi.json"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Start server
uvicorn src.api.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload=$RELOAD \
    --log-level info
