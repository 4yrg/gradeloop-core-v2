# Email Notification Service

## Overview

The Email Notification Service is a dedicated microservice responsible for handling all email communications within the GradeLoop platform. It provides reliable, template-driven email delivery with SMTP integration, event-driven processing via RabbitMQ, and secure credential management through HashiCorp Vault.

## Features

- **SMTP Integration**: Configurable SMTP settings with secure credential storage
- **Template Engine**: HTML email templates with dynamic data rendering
- **Event-Driven Architecture**: Processes events from RabbitMQ for user registration, password resets, etc.
- **Retry Logic**: Exponential backoff retry mechanism for failed email deliveries
- **Security**: TLS support, secure credential handling via Vault
- **Health Monitoring**: Health check endpoints for service monitoring
- **API Testing**: Bruno API collection for comprehensive testing

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  HTTP Handler   │    │  Event Handler  │    │  Email Service  │
│                 │    │                 │    │   (Business     │
│ REST API        │────┤ RabbitMQ        │────┤    Logic)       │
│ Endpoints       │    │ Consumer        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                    ┌─────────────────┐               │
                    │  Vault Repo     │               │
                    │                 │◄──────────────┤
                    │ SMTP Config     │               │
                    └─────────────────┘               │
                                                      │
                    ┌─────────────────┐               │
                    │  SMTP Repo      │               │
                    │                 │◄──────────────┘
                    │ Email Delivery  │
                    └─────────────────┘
```

### Event Flow

1. **Event Reception**: Service receives events from RabbitMQ (user.created, password.reset.requested)
2. **Template Processing**: Renders appropriate email template with event data
3. **SMTP Delivery**: Sends email via configured SMTP server with retry logic
4. **Status Logging**: Logs delivery status and handles failures gracefully

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_HOST` | HTTP server bind address | `localhost` |
| `SERVER_PORT` | HTTP server port | `8080` |
| `RABBITMQ_URL` | RabbitMQ connection string | `amqp://guest:guest@localhost:5672/` |
| `RABBITMQ_EXCHANGE` | RabbitMQ exchange name | `gradeloop.events` |
| `RABBITMQ_QUEUE` | Email notification queue name | `email.notifications` |
| `VAULT_ADDR` | Vault server address | `http://localhost:8200` |
| `VAULT_TOKEN` | Vault authentication token | `dev-root-token` |
| `SMTP_SECRET_PATH` | Path to SMTP secrets in Vault | `secret/data/smtp` |

### Vault Secrets

SMTP configuration is stored in Vault at `secret/smtp`:

```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "your-email@gmail.com",
  "password": "your-app-password",
  "use_tls": "true"
}
```

## API Endpoints

### Health Check
```
GET /health
```

### Send Email
```
POST /api/v1/email/send
Content-Type: application/json

{
  "to": ["user@example.com"],
  "subject": "Welcome to GradeLoop",
  "template_name": "account_activation.html",
  "template_data": {
    "Name": "John Doe",
    "ActivationLink": "https://gradeloop.com/activate?token=abc123"
  }
}
```

### Test Template
```
POST /api/v1/email/test-template
Content-Type: application/json

{
  "template_name": "account_activation.html",
  "test_email": "test@example.com",
  "template_data": {
    "Name": "Test User",
    "ActivationLink": "https://gradeloop.com/activate?token=test123"
  }
}
```

## Email Templates

### Available Templates

1. **account_activation.html**: Account activation emails
   - Required data: `Name`, `ActivationLink`

2. **password_reset.html**: Password reset emails
   - Required data: `Name`, `ResetLink`

3. **welcome.html**: Welcome emails after successful activation
   - Required data: `Name`, `DashboardLink`, `GettingStartedLink`

### Template Development

Templates are stored in the `templates/` directory and use Go's `html/template` package. They support:

- Variable interpolation: `{{.Name}}`
- HTML content with CSS styling
- Responsive design for mobile devices
- Security features (XSS protection)

## Event Processing

### Supported Events

#### user.created
```json
{
  "event_id": "evt_123",
  "event_type": "user.created",
  "user_id": "user_456",
  "email": "user@example.com",
  "name": "John Doe",
  "timestamp": "2026-02-10T10:00:00Z"
}
```

#### password.reset.requested
```json
{
  "event_id": "evt_789",
  "event_type": "password.reset.requested",
  "user_id": "user_456",
  "email": "user@example.com",
  "name": "John Doe",
  "reset_link": "https://gradeloop.com/reset?token=xyz789",
  "timestamp": "2026-02-10T10:00:00Z"
}
```

## Deployment

### Docker

```bash
# Build the image
docker build -t gradeloop/email-notify-service .

# Run with Docker Compose
docker-compose -f infra/compose/compose.dev.yaml up -d
```

### Local Development

1. **Install Dependencies**
   ```bash
   cd apps/services/email-notify-service
   go mod download
   ```

2. **Set Up Vault Secrets**
   ```bash
   # Run Vault in dev mode
   docker-compose -f infra/compose/compose.dev.yaml up vault vault-init

   # Verify SMTP secrets
   vault kv get secret/smtp
   ```

3. **Start RabbitMQ**
   ```bash
   docker-compose -f infra/compose/compose.dev.yaml up rabbitmq
   ```

4. **Run the Service**
   ```bash
   go run cmd/main.go
   ```

## Testing

### Bruno API Collection

The service includes a comprehensive Bruno API collection for testing located in `bruno-api/`. Tests cover:

- Health check endpoints
- Email sending with various templates
- Template testing functionality
- Error handling scenarios
- Input validation

### Manual Testing

1. **Start Services**: Run Docker Compose setup
2. **Import Bruno Collection**: Open `bruno-api/` in Bruno
3. **Run Tests**: Execute test scenarios against the running service
4. **Check Email Delivery**: Monitor SMTP logs or use MailHog for testing

### RabbitMQ Testing

```bash
# Publish test event to RabbitMQ
curl -X POST http://localhost:15672/api/exchanges/gradeloop.events/gradeloop.events/publish \
  -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {},
    "routing_key": "user.created",
    "payload": "{\"event_type\":\"user.created\",\"user_id\":\"test123\",\"email\":\"test@gradeloop.com\",\"name\":\"Test User\"}"
  }'
```

## Monitoring and Logging

### Health Checks

- **HTTP Health**: `GET /health` returns service status
- **Docker Health**: Container health checks via wget
- **RabbitMQ Health**: Connection status monitoring
- **Vault Health**: Secret retrieval verification

### Logging

The service provides structured logging for:
- Email delivery attempts and status
- Event processing results
- SMTP connection issues
- Configuration loading
- Template rendering errors

### Metrics

Key metrics to monitor:
- Email send success/failure rates
- Template rendering performance
- RabbitMQ message processing latency
- SMTP connection health

## Security Considerations

- **Credential Management**: All SMTP credentials stored in Vault
- **TLS Encryption**: Email transmission secured via TLS
- **Input Validation**: Request validation for all API endpoints
- **Template Security**: XSS protection in email templates
- **Network Security**: Service-to-service communication over private networks

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failures**
   - Verify credentials in Vault
   - Check Gmail App Password settings
   - Ensure TLS is properly configured

2. **Template Rendering Errors**
   - Validate template syntax
   - Check required template data fields
   - Verify template file permissions

3. **RabbitMQ Connection Issues**
   - Check RabbitMQ service status
   - Verify connection string and credentials
   - Monitor queue bindings and exchanges

4. **Vault Integration Problems**
   - Ensure Vault is unsealed and accessible
   - Verify token permissions and policies
   - Check secret paths and formats

### Debug Mode

Enable verbose logging by setting log level to debug in the container environment.

## Development

### Adding New Templates

1. Create HTML template in `templates/` directory
2. Define required template data structure
3. Add template validation to service
4. Create Bruno test cases
5. Update documentation

### Adding New Event Types

1. Define event structure in `domain/models.go`
2. Add event handler in `EmailService`
3. Register event type in `EventHandler`
4. Create appropriate email template
5. Add test coverage

## Contributing

Please follow the established patterns for:
- Error handling with context
- Structured logging
- Dependency injection
- Interface segregation
- Test coverage

For more details, see the main project [CONTRIBUTING.md](../../../CONTRIBUTING.md).