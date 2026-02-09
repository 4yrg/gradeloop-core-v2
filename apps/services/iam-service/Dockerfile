# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory to the root of the project to access shared libraries
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files for the service and the shared library
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.sum ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.sum ./shared/libs/go/secrets/

# Download dependencies for the IAM service
WORKDIR /app/apps/services/iam-service
RUN go mod download

# Copy the entire source code from the root context
WORKDIR /app
COPY . .

# Build the application binary from the service directory
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

# Copy the binary and environment example from the builder
# Use --chown to ensure the non-root user owns the files
COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/iam-service/iam-service .
COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/iam-service/.env.example ./.env

# Switch to the non-root user
USER gradeloop

# Expose the application port
EXPOSE 3000

# Run the binary
CMD ["./iam-service"]
