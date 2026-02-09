# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory to the project root
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# 1. Copy dependency files first to leverage Docker layer caching
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.su[m] ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.su[m] ./shared/libs/go/secrets/

# Download dependencies
WORKDIR /app/apps/services/iam-service
RUN go mod download

# 2. Explicitly copy required source code instead of 'COPY . .'
# This avoids leaking sensitive files (like .git, local envs) into the image
WORKDIR /app
COPY shared/libs/go/secrets ./shared/libs/go/secrets
COPY apps/services/iam-service ./apps/services/iam-service

# Build the application binary
WORKDIR /app/apps/services/iam-service
RUN CGO_ENABLED=0 GOOS=linux go build -o iam-service ./cmd/main.go

# Final stage
FROM alpine:3.21

# Create a non-root user and group for security
RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

# Set the working directory
WORKDIR /home/gradeloop

# Install CA certificates for secure communication
RUN apk --no-cache add ca-certificates

# 3. Securely copy the binary:
# - Use --chown=root:root to ensure the non-root user cannot modify the binary
# - Use --chmod=755 to make it executable but not writable
COPY --from=builder --chown=root:root --chmod=755 /app/apps/services/iam-service/iam-service .

# Switch to the non-root user for runtime
USER gradeloop

# Expose the application port
EXPOSE 3000

# Run the binary
CMD ["./iam-service"]
