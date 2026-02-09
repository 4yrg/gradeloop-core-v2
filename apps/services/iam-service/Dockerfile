# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory to the project root
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files for the service and shared library
# We use wildcard patterns for go.sum to prevent build failure if it's missing or ignored
# This ensures Docker layers are cached based on dependency changes
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.su[m] ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.su[m] ./shared/libs/go/secrets/

# Change to the service directory and download dependencies
WORKDIR /app/apps/services/iam-service
RUN go mod download

# Copy the entire project source code from the root context
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

# Copy the binary from the builder
# Use --chown to ensure the non-root user owns the files
COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/iam-service/iam-service .

# Switch to the non-root user
USER gradeloop

# Expose the application port
EXPOSE 3000

# Run the binary
CMD ["./iam-service"]
