# GradeLoop Secrets Client (Go)

A Go library for securely retrieving secrets from HashiCorp Vault.

## Features

- KV v2 secrets engine support
- Automatic retry logic with exponential backoff
- Context-aware operations
- Type-safe configuration helpers
- Connection string builders for common services

## Installation

```bash
go get github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets
```

## Usage

### Basic Usage

```go
package main

import (
    "context"
    "log"
    
    "github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets"
)

func main() {
    // Create client with default config (reads from environment)
    client, err := secrets.NewClient(nil)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()
    
    ctx := context.Background()
    
    // Get a single secret value
    apiKey, err := client.GetSecret(ctx, "api-keys/openai", "api_key")
    if err != nil {
        log.Fatal(err)
    }
    
    log.Printf("Retrieved API key: %s...", apiKey[:10])
}
```

### Database Configuration

```go
// Get database configuration
dbConfig, err := client.GetDatabaseConfig(ctx)
if err != nil {
    log.Fatal(err)
}

// Use the connection string
connStr := dbConfig.ConnectionString()
db, err := sql.Open("postgres", connStr)
```

### Custom Configuration

```go
cfg := &secrets.Config{
    Address:    "http://vault.example.com:8200",
    Token:      "s.your-vault-token",
    Namespace:  "gradeloop",
    MountPath:  "secret",
    Timeout:    30 * time.Second,
    MaxRetries: 5,
}

client, err := secrets.NewClient(cfg)
```

### Retrieving All Secrets at a Path

```go
secretsMap, err := client.GetSecretMap(ctx, "services/my-service")
if err != nil {
    log.Fatal(err)
}

for key, value := range secretsMap {
    log.Printf("%s: %v", key, value)
}
```

## Environment Variables

The client reads the following environment variables when using `DefaultConfig()`:

- `VAULT_ADDR`: Vault server address (default: `http://localhost:8200`)
- `VAULT_TOKEN`: Vault authentication token
- `VAULT_NAMESPACE`: Vault namespace (optional)
- `VAULT_MOUNT_PATH`: KV secrets engine mount path (default: `secret`)

## Error Handling

The client returns structured errors that can be inspected:

```go
secret, err := client.GetSecret(ctx, "path", "key")
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("Request timed out")
    } else {
        log.Printf("Failed to get secret: %v", err)
    }
}
```

## Testing

```bash
go test ./...
```

## Security Considerations

1. **Never hardcode tokens**: Always use environment variables or secure token injection
2. **Use short-lived tokens**: Configure appropriate TTLs for your use case
3. **Implement token renewal**: For long-running services, implement token renewal logic
4. **Audit logging**: Ensure Vault audit logging is enabled in production

## Integration with Services

Add to your service's `main.go`:

```go
func main() {
    // Initialize secrets client
    secretsClient, err := secrets.NewClient(nil)
    if err != nil {
        log.Fatalf("Failed to initialize secrets client: %v", err)
    }
    defer secretsClient.Close()
    
    // Get database configuration
    dbConfig, err := secretsClient.GetDatabaseConfig(context.Background())
    if err != nil {
        log.Fatalf("Failed to get database config: %v", err)
    }
    
    // Use the configuration
    db, err := sql.Open("postgres", dbConfig.ConnectionString())
    // ... rest of your application
}
```

## License

Copyright © 2024 GradeLoop
