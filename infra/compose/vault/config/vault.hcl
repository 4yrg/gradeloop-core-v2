# Vault Development Configuration
# This configuration is used for local development only
# DO NOT use in production environments

ui = true

# HTTP Listener
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

# Enable audit logging to file
audit {
  type = "file"
  options = {
    file_path = "/vault/logs/audit.log"
  }
}

# Development mode storage (in-memory)
# Note: In dev mode, this is overridden by -dev flag
storage "inmem" {}

# Default TTL and Max TTL for tokens
default_lease_ttl = "168h"  # 7 days
max_lease_ttl     = "720h"  # 30 days

# API address
api_addr = "http://127.0.0.1:8200"

# Telemetry for development monitoring
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# Log level
log_level = "debug"

# Disable mlock in development (not recommended for production)
disable_mlock = true
