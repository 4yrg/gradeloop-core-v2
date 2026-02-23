# gradeloop-core-v2/apps/services/cipas-service/Makefile
# Makefile for CIPAS service (dev, lint, test, build targets)
#
# Usage:
#   make help         # show help
#   make dev          # run uvicorn with auto-reload for development
#   make lint         # run ruff and mypy
#   make test         # run pytest
#   make build        # build wheel with poetry and docker image (optional)
#   make docker-build # build container image
#   make clean        # remove caches and build artifacts
#
# NOTE: This Makefile assumes you're running it from the service directory:
#   cd gradeloop-core-v2/apps/services/cipas-service && make <target>

PYTHONPATH := src
POETRY ?= poetry
UVICORN ?= uvicorn
PYTEST ?= pytest
RUFF ?= ruff
MYPY ?= mypy
IMAGE_NAME ?= cipas-service:local
DOCKERFILE ?= Dockerfile

.DEFAULT_GOAL := help

help:
	@echo "Makefile targets for CIPAS service"
	@echo ""
	@echo "Available targets:"
	@echo "  dev           Run development server (uvicorn with --reload)"
	@echo "  lint          Run linters (ruff) and type checks (mypy)"
	@echo "  test          Run test suite (pytest)"
	@echo "  build         Build package (poetry) and Docker image (docker-build)"
	@echo "  docker-build  Build Docker image"
	@echo "  install-dev   Install dependencies (poetry install)"
	@echo "  clean         Remove caches and build artifacts"
	@echo ""

# Development server with reload. Exposes on 0.0.0.0:8000
dev:
	@echo "[dev] starting uvicorn (reload)"
	@PYTHONPATH=$(PYTHONPATH) $(POETRY) run $(UVICORN) cipas.main:app --reload --host 0.0.0.0 --port 8000

# Linting and static typing
lint: lint-ruff lint-mypy

lint-ruff:
	@echo "[lint] running ruff"
	@$(POETRY) run $(RUFF) check src tests

lint-mypy:
	@echo "[lint] running mypy (strict settings from pyproject.toml)"
	@PYTHONPATH=$(PYTHONPATH) $(POETRY) run $(MYPY) src tests

# Run tests (pytest)
test:
	@echo "[test] running pytest"
	@PYTHONPATH=$(PYTHONPATH) $(POETRY) run $(PYTEST) -q

# Build python package and docker image
build: build-poetry docker-build

build-poetry:
	@echo "[build] building wheel / sdist with poetry"
	@$(POETRY) build

docker-build:
	@echo "[docker] building docker image: $(IMAGE_NAME)"
	@docker build -t $(IMAGE_NAME) -f $(DOCKERFILE) .

# Install dependencies including dev-deps
install-dev:
	@echo "[install] installing dependencies via poetry (including dev deps)"
	@$(POETRY) install

# Clean caches and build artifacts
clean:
	@echo "[clean] removing caches and build artifacts"
	@rm -rf .pytest_cache .mypy_cache .ruff_cache build dist __pycache__ *.egg-info
	@find . -name \"__pycache__\" -type d -prune -exec rm -rf {} +

.PHONY: help dev lint lint-ruff lint-mypy test build build-poetry docker-build install-dev clean
