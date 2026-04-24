# =============================================================================
# GradeLoop API Gateway - Makefile
# Management commands for Kong Gateway
# =============================================================================

.PHONY: help status sync validate clean logs restart migrate

help:
	@echo "GradeLoop API Gateway - Makefile Commands"
	@echo "===================================="
	@echo "make status      - Check Kong gateway status"
	@echo "make sync      - Sync declarative config to Kong"
	@echo "make validate  - Validate kong.yml syntax"
	@echo "make logs      - View Kong gateway logs"
	@echo "make restart   - Restart Kong gateway"
	@echo "make migrate  - Run database migrations"
	@echo "make clean    - Remove local development files"

# Check Kong status
status:
	@echo "Checking Kong Gateway status..."
	@curl -s http://localhost:8001/status || echo "Kong gateway not running"

# Sync configuration to Kong using deck
sync:
	@echo "Syncing configuration to Kong..."
	@docker run --rm --network gradeloop-core-v2_gradeloop-network \
		-e KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yml \
		-v $$(pwd)/config:/usr/local/kong/declarative:ro \
		kong:3.4 \
		deck sync -s /usr/local/kong/declarative/kong.yml \
		--kong-url http://kong-gateway:8001 \
		--verify-ssl=false || echo "Using deck sync alternative"

# Alternative: Push config directly via API
sync-api:
	@echo "Pushing configuration to Kong via Admin API..."
	@curl -s -X POST http://localhost:8001/config \
		-H "Content-Type: application/json" \
		--data-binary @config/kong.yml || echo "Failed to sync config"

# Validate declarative config
validate:
	@echo "Validating kong.yml..."
	@docker run --rm -v $$(pwd)/config:/usr/local/kong/declarative:ro \
		kong:3.4 \
		validate -c /usr/local/kong/declarative/kong.yml || echo "Validation failed"

# View logs
logs:
	@docker logs -f gradeloop-kong-gateway

# Restart Kong
restart:
	@docker compose restart kong-gateway

# Run migrations
migrate:
	@docker compose up kong-migrations

# Clean local files
clean:
	@rm -rf .deck*
	@echo "Cleaned local files"