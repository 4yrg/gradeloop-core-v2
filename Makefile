# Makefile for gradeloop-core-v2
# Builds all services under apps/services using the host Go toolchain when available,
# and falls back to a Dockerized Golang image when `go` is not installed on the host.
#
# Usage:
#   make                -> builds all services
#   make build-all      -> same as above
#   make build SERVICE=my-service  -> builds a single service (directory name under apps/services)
#   make clean          -> removes generated binaries under each service's bin/ directory
#   make help           -> prints this help
#
# The Makefile assumes each service has a build entrypoint at `cmd/main.go`.
# Adjust `GO_BUILD_TARGET` or the per-service commands if your layout differs.

SHELL := /bin/sh
ROOT := $(shell pwd)
GO_IMAGE ?= golang:1.26
GO_BUILD_TARGET ?= ./cmd/main.go
GO_BUILD_ENV := GOTOOLCHAIN=auto
OUT_DIR ?= bin

# Discover service directories under apps/services (takes the immediate children)
SERVICES := $(notdir $(wildcard apps/services/*))

.PHONY: all help build-all build clean dev-logs dev-down dev prod-up prod-down prod-logs prod-restart $(SERVICES)

all: build-all

help:
	@echo "Makefile targets:"
	@echo "  make            -> dev (runs all services in Docker)"
	@echo "  make dev        -> start all services in Docker (development)"
	@echo "  make dev-logs   -> view logs for all services"
	@echo "  make dev-down   -> stop all development services"
	@echo "  make prod-up    -> start production environment in Docker"
	@echo "  make prod-down  -> stop production environment"
	@echo ""
	@echo "Build commands:"
	@echo "  make build SERVICE=<name> -> build a single service"
	@echo "  make build-all            -> build all services"
	@echo "  make clean                -> remove built binaries"
	@echo ""
	@echo "Examples:"
	@echo "  make dev                  # Start all services in Docker"
	@echo "  make build SERVICE=academic-service"

# Default entry to build every discovered service
# Builds every discovered service (regardless of language)
build-all: $(SERVICES)
	@echo "All services built."

# New: build only Go services under apps/services
# This target will detect Go services (by presence of go.mod or any .go files within two levels)
# and invoke the per-service `build` target only for those.
.PHONY: build-go-all
build-go-all:
	@echo "Building only Go services under apps/services..."
	@for d in apps/services/*; do \
		if [ -d "$$d" ]; then \
			# consider it a Go service if it has go.mod or any .go files (within two levels) \
			if [ -f "$$d/go.mod" ] || find "$$d" -maxdepth 2 -name '*.go' | grep -q .; then \
				svc=$$(basename "$$d"); \
				echo " -> building Go service: $$svc"; \
				$(MAKE) build SERVICE=$$svc || { echo "Build failed for $$svc"; exit 1; }; \
			else \
				echo " -> skipping non-Go service: $$(basename "$$d")"; \
			fi; \
		fi; \
	done

# Per-service rule: each service directory is a target
# This allows `make academic-service` too.
$(SERVICES):
	@$(MAKE) build SERVICE=$@

# Primary build target: builds a single service specified via SERVICE variable.
# Example: make build SERVICE=academic-service
# Tries building with the host 'go' tool first. If the host build fails (non-zero exit),
# it will fall back to building inside Docker so transient host toolchain issues don't stop CI/dev workflow.
build:
	@if [ -z "$(SERVICE)" ]; then \
		echo "ERROR: SERVICE variable not set. Example: make build SERVICE=academic-service"; \
		exit 1; \
	fi
	@echo "Building service: $(SERVICE)"
	@if [ ! -d "apps/services/$(SERVICE)" ]; then \
		echo "ERROR: service directory 'apps/services/$(SERVICE)' does not exist"; \
		exit 1; \
	fi
	@printf " -> ensuring output directory exists: apps/services/%s/$(OUT_DIR)\n" "$(SERVICE)"
	@mkdir -p "apps/services/$(SERVICE)/$(OUT_DIR)"
	@echo " -> checking for host 'go' tool..."
	@entry_point=$(GO_BUILD_TARGET); \
	if [ ! -f "apps/services/$(SERVICE)/$$entry_point" ]; then \
		echo " -> $(GO_BUILD_TARGET) not found, searching in cmd/..."; \
		found=$$(find "apps/services/$(SERVICE)/cmd" -name "main.go" | head -n 1); \
		if [ -n "$$found" ]; then \
			entry_point="./$${found#apps/services/$(SERVICE)/}"; \
			echo " -> found entry point: $$entry_point"; \
		else \
			echo "ERROR: could not find main.go in apps/services/$(SERVICE)/cmd"; \
			exit 1; \
		fi; \
	fi; \
	if command -v go >/dev/null 2>&1; then \
		echo " -> attempting build with host go"; \
		cd "apps/services/$(SERVICE)" && $(GO_BUILD_ENV) go build -o "$(OUT_DIR)/$(SERVICE)" "$$entry_point"; \
		exit_code=$$?; \
		if [ $$exit_code -ne 0 ]; then \
			echo " -> host 'go' build failed (exit $$exit_code). Falling back to Docker ($(GO_IMAGE))..."; \
			docker pull $(GO_IMAGE) >/dev/null || true; \
			docker run --rm -v "$(ROOT)":/work -w /work/apps/services/$(SERVICE) $(GO_IMAGE) sh -c 'mkdir -p "$(OUT_DIR)" && $(GO_BUILD_ENV) go build -o "$(OUT_DIR)/$(SERVICE)" "'"$$entry_point"'"'; \
			exit_code=$$?; \
		fi; \
	else \
		echo " -> host 'go' not found, building inside Docker ($(GO_IMAGE))"; \
		docker pull $(GO_IMAGE) >/dev/null || true; \
		docker run --rm -v "$(ROOT)":/work -w /work/apps/services/$(SERVICE) $(GO_IMAGE) sh -c 'mkdir -p "$(OUT_DIR)" && $(GO_BUILD_ENV) go build -o "$(OUT_DIR)/$(SERVICE)" "'"$$entry_point"'"'; \
		exit_code=$$?; \
	fi; \
	if [ $$exit_code -ne 0 ]; then \
		echo "ERROR: build failed for service $(SERVICE) (exit $$exit_code)"; \
		exit $$exit_code; \
	else \
		echo "SUCCESS: built services/$(SERVICE) -> apps/services/$(SERVICE)/$(OUT_DIR)/$(SERVICE)"; \
	fi

# Clean up built binaries
clean:
	@echo "Cleaning binaries under apps/services/*/$(OUT_DIR)/"
	@for d in apps/services/*; do \
		if [ -d $$d/$(OUT_DIR) ]; then \
			echo " - cleaning $$d/$(OUT_DIR)"; \
			rm -rf $$d/$(OUT_DIR); \
		fi \
	done
	@echo "Clean complete."

# Convenience target to show what would be built (dry-run)
.PHONY: list
list:
	@echo "Discovered services under apps/services:"
	@for s in $(SERVICES); do echo " - $$s"; done
	@echo ""
	@echo "To build a service: make build SERVICE=<name>"

# Provide a helpful message if someone tries to invoke `go` from the Makefile directly
# (not strictly necessary, but explicit guidance is useful)
print-go-guidance:
	@echo "If you prefer to build with the host Go toolchain, install Go:"
	@echo "  Debian/Ubuntu: sudo apt install golang-go"
	@echo "  or download from https://go.dev/dl"
	@echo "Alternatively this Makefile will automatically fallback to Docker if 'go' is not present."

# Container runtime (docker or podman)
COMPOSE := $(shell if command -v podman >/dev/null 2>&1; then echo "podman compose"; elif command -v docker >/dev/null 2>&1; then echo "docker compose"; else echo "docker compose"; fi)
COMPOSE_DIR := $(ROOT)/infra/compose

# =============================================================================
# Development Targets (Local Service Execution)
# =============================================================================

GO_SERVICES := iam email academic assessment cipas-xai notification
PY_SERVICES := ivas acafs keystroke cipas-ai cipas-semantics cipas-syntactics

dev-logs:
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.dev.yaml logs -f

dev-down:
	@echo "Stopping development environment..."
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.dev.yaml down
	@echo "Development environment stopped."

dev:
	@echo "Starting development environment (all in Docker)..."
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.dev.yaml up -d
	@echo ""
	@echo "Development environment started!"
	@echo ""
	@echo "Services:"
	@echo "  - Gateway:    http://178.105.102.246:8000"
	@echo "  - RabbitMQ:   http://localhost:15672"
	@echo "  - SeaweedFS:  http://localhost:9320"
	@echo ""
	@echo "Go Services (80xx):"
	@echo "  - IAM:        http://localhost:8081"
	@echo "  - Email:      http://localhost:8082"
	@echo "  - Academic:   http://localhost:8083"
	@echo "  - Assessment: http://localhost:8084"
	@echo "  - CIPAS-XAI:  http://localhost:8085"
	@echo "  - Notification: http://localhost:8086"
	@echo ""
	@echo "Python Services (81xx):"
	@echo "  - IVAS:            http://localhost:8101"
	@echo "  - ACAFS:           http://localhost:8102"
	@echo "  - Keystroke:       http://localhost:8103"
	@echo "  - CIPAS-AI:        http://localhost:8104"
	@echo "  - CIPAS-Semantics: http://localhost:8105"
	@echo "  - CIPAS-Syntactics: http://localhost:8106"
	@echo ""
	@echo "View logs: make dev-logs"
	@echo "Stop services: make dev-down"

# =============================================================================
# Production Targets (Docker-based)
# =============================================================================

# Start everything in Docker (production mode)
prod-up:
	@echo "Starting production environment..."
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.prod.yaml up -d
	@echo ""
	@echo "Production environment started!"
	@echo "  Kong Gateway: http://178.105.102.246:8000"
	@echo "  RabbitMQ:   http://localhost:15672"
	@echo "  MinIO:     http://localhost:9001"

# Stop production
prod-down:
	@echo "Stopping production environment..."
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.prod.yaml down
	@echo "Production environment stopped."

# View production logs
prod-logs:
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.prod.yaml logs -f

# Restart a specific service
prod-restart:
	@if [ -z "$(SERVICE)" ]; then \
		echo "ERROR: SERVICE variable not set. Example: make prod-restart SERVICE=iam"; \
		exit 1; \
	fi
	@echo "Restarting service $(SERVICE)..."
	$(COMPOSE) -f $(COMPOSE_DIR)/compose.prod.yaml restart $(SERVICE)


