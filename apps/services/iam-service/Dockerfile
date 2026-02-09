# Build stage
FROM golang:1.25-alpine AS builder

# Set the working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files and download modules (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
# Note: Ensure a .dockerignore file exists to prevent copying sensitive files
COPY . .

# Build the application binary
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
COPY --from=builder --chown=gradeloop:gradeloop /app/iam-service .
COPY --from=builder --chown=gradeloop:gradeloop /app/.env.example ./.env

# Switch to the non-root user
USER gradeloop

# Expose the application port
EXPOSE 3000

# Run the binary
CMD ["./iam-service"]
