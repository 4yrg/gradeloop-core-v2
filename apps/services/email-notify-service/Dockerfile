# Build stage
FROM golang:1.25.7-alpine AS builder

# Set working directory
WORKDIR /app

# Install git (needed for go mod download)
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/main.go

# Runtime stage
FROM alpine:latest

# Add ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata

# Set timezone
ENV TZ=UTC

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G appuser appuser

# Copy binary from builder stage
COPY --from=builder /app/main .

# Copy templates
COPY --from=builder /app/templates ./templates

# Change ownership to app user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./main"]


# Dev stage: fast local development image with hot-reload (air)
FROM golang:1.25.7-alpine AS dev
WORKDIR /app

RUN apk add --no-cache git ca-certificates curl \
    && mkdir -p /go/bin \
    && curl -sSfL https://raw.githubusercontent.com/cosmtrek/air/master/install.sh | sh

# Copy module files to leverage cache
COPY go.mod go.sum ./
WORKDIR /app
RUN go mod download

# Expose port and run air; source is expected to be mounted by compose
EXPOSE 8080
ENV PATH="/go/bin:${PATH}"

RUN printf '#!/bin/sh\nset -e\ncd /app || true\nif [ ! -f .air.toml ]; then\n  if command -v air >/dev/null 2>&1; then\n    air init\n  fi\nfi\nexec air -c .air.toml\n' > /usr/local/bin/air-entrypoint.sh \
    && chmod +x /usr/local/bin/air-entrypoint.sh

CMD ["/bin/sh", "/usr/local/bin/air-entrypoint.sh"]