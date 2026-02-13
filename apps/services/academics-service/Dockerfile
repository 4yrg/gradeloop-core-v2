# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory to the project root
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# 1. Copy dependency files first to leverage Docker layer caching
COPY apps/services/academics-service/go.mod apps/services/academics-service/go.sum ./apps/services/academics-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.sum ./shared/libs/go/secrets/
COPY shared/libs/go/logger/go.mod shared/libs/go/logger/go.sum ./shared/libs/go/logger/
COPY shared/libs/go/middleware/go.mod shared/libs/go/middleware/go.sum ./shared/libs/go/middleware/

# Download dependencies
WORKDIR /app/apps/services/academics-service
RUN go mod tidy
RUN go mod download

# 2. Explicitly copy required source code instead of 'COPY . .'
WORKDIR /app
COPY shared/libs/go/secrets ./shared/libs/go/secrets
COPY shared/libs/go/logger ./shared/libs/go/logger
COPY shared/libs/go/middleware ./shared/libs/go/middleware
COPY apps/services/academics-service ./apps/services/academics-service

# Build the application binary
WORKDIR /app/apps/services/academics-service
RUN CGO_ENABLED=0 GOOS=linux go build -o academics-service ./cmd/main.go

# Final stage
FROM alpine:3.21

# Create a non-root user and group for security
RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

# Set the working directory
WORKDIR /home/gradeloop

# Install CA certificates and curl for health checks
RUN apk --no-cache add ca-certificates curl

# 3. Securely copy the binary:
COPY --from=builder --chown=root:root --chmod=755 /app/apps/services/academics-service/academics-service .

# Switch to the non-root user for runtime
USER gradeloop

# Expose the application port
EXPOSE 3001

# Run the binary
CMD ["./academics-service"]
