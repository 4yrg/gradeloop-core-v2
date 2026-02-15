# Email Notification Service

The **Email Notification Service** is a microservice responsible for sending transactional emails via SMTP. It is built with **Java 21** and **Spring Boot 4.x**, following **Clean Architecture** principles.

## 🚀 Features

- **Transactional Emails**: Send HTML and Text emails via Gmail SMTP.
- **Template Rendering**: Uses **Thymeleaf** for dynamic content rendering.
- **Retry Mechanism**: Exponential backoff retry logic (3 attempts: 30s, 60s, 120s) for transient failures (e.g., SMTP connection issues).
- **Delivery Tracking**: Logs delivery status (`SENT`, `FAILED`, `RETRYING`, `SKIPPED`).
- **REST API**: Simple POST endpoint to trigger emails (primary use: internal testing/verification).

## 🛠️ Technology Stack

- **Language**: Java 21
- **Framework**: Spring Boot 4.0.2
- **Build Tool**: Maven (Wrapper provided)
- **Email**: JavaMailSender
- **Templates**: Thymeleaf
- **Resilience**: Spring Retry + Spring AOP

## 🔧 Configuration

The service is configured via environment variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP Server Host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP Server Port | `587` |
| `SMTP_USERNAME` | SMTP Username/Email | - |
| `SMTP_PASSWORD` | SMTP Password/App Password | - |
| `SMTP_AUTH` | Enable SMTP Auth | `true` |
| `SMTP_STARTTLS` | Enable STARTTLS | `true` |
| `RABBITMQ_HOST` | RabbitMQ Host | `localhost` |
| `RABBITMQ_PORT` | RabbitMQ Port | `5672` |
| `RABBITMQ_USERNAME` | RabbitMQ User | `guest` |
| `RABBITMQ_PASSWORD` | RabbitMQ Password | `guest` |

## 🏃 Run via Docker

The service is included in the project's Docker Compose setup.

```bash
# Run the entire stack (or just this service)
docker compose -f infra/compose/compose.dev.yaml up -d email-notify-service
```

## 🧪 API Usage (Bruno)

A [Bruno](https://www.usebruno.com/) collection is available in `bruno/`.

### Send Email Endpoint

`POST /api/v1/email/send`

**Request Body:**
```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "templateName": "account_activation",
  "variables": {
    "name": "Bilal",
    "activationLink": "https://gradeloop.com/activate"
  }
}
```

**Templates:**
- `account_activation` (Requires: `name`, `activationLink`)
- `password_reset` (Requires: `name`, `resetLink`)

## 🏗️ Project Structure

```
src/main/java/com/gradeloop/email/
 ├── config/       # Configuration (RabbitMQ, Retry)
 ├── controller/   # REST Controller
 ├── model/        # DTOs and Enums
 ├── service/      # Business Logic (EmailSender, Templates)
 └── EmailServiceApplication.java
```
