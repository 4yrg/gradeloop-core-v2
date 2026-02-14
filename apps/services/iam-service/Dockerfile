# Multi-stage build

# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory to the project root
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files first to leverage Docker layer caching
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.sum ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.sum ./shared/libs/go/secrets/
COPY shared/libs/go/logger/go.mod shared/libs/go/logger/go.sum ./shared/libs/go/logger/
COPY shared/libs/go/middleware/go.mod shared/libs/go/middleware/go.sum ./shared/libs/go/middleware/

# Download dependencies
WORKDIR /app/apps/services/iam-service
RUN go mod tidy
RUN go mod download

# Explicitly copy required source code instead of 'COPY . .'
WORKDIR /app
COPY shared/libs/go/secrets ./shared/libs/go/secrets
COPY shared/libs/go/logger ./shared/libs/go/logger
COPY shared/libs/go/middleware ./shared/libs/go/middleware
COPY apps/services/iam-service ./apps/services/iam-service

# Build the application
WORKDIR /app/apps/services/iam-service
RUN CGO_ENABLED=0 GOOS=linux go build -o iam-service ./cmd/server

# Production stage
FROM alpine:3.19

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN adduser -D -s /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/apps/services/iam-service/iam-service .

# Change ownership to appuser
RUN chown appuser:appuser iam-service

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Run the application
CMD ["./iam-service"]