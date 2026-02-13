# Build stage
FROM golang:1.25.7-alpine AS builder

# Set the working directory to the project root
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# 1. Copy dependency files first to leverage Docker layer caching
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.sum ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.sum ./shared/libs/go/secrets/
COPY shared/libs/go/logger/go.mod shared/libs/go/logger/go.sum ./shared/libs/go/logger/
COPY shared/libs/go/middleware/go.mod shared/libs/go/middleware/go.sum ./shared/libs/go/middleware/

# Download dependencies
WORKDIR /app/apps/services/iam-service
RUN go mod download

# 2. Explicitly copy required source code instead of 'COPY . .'
# This avoids leaking sensitive files (like .git, local envs) into the image
WORKDIR /app
COPY shared/libs/go/secrets ./shared/libs/go/secrets
COPY shared/libs/go/logger ./shared/libs/go/logger
COPY shared/libs/go/middleware ./shared/libs/go/middleware
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

# Install CA certificates and curl for health checks
RUN apk --no-cache add ca-certificates curl

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


# Dev stage: provides a fast local development image with file-mount hot-reload
FROM golang:1.25.7-alpine AS dev
WORKDIR /app

# Ensure git is available and install air (live-reload tool)
RUN apk add --no-cache git ca-certificates curl \
	&& mkdir -p /go/bin \
	&& curl -sSfL https://raw.githubusercontent.com/cosmtrek/air/master/install.sh | sh

# Keep Go module files in the image to leverage cached downloads
COPY apps/services/iam-service/go.mod apps/services/iam-service/go.sum ./apps/services/iam-service/
COPY shared/libs/go/secrets/go.mod shared/libs/go/secrets/go.sum ./shared/libs/go/secrets/
COPY shared/libs/go/logger/go.mod shared/libs/go/logger/go.sum ./shared/libs/go/logger/
COPY shared/libs/go/middleware/go.mod shared/libs/go/middleware/go.sum ./shared/libs/go/middleware/

WORKDIR /app/apps/services/iam-service
RUN go mod download

# Expose port and run air; source is expected to be mounted by compose
WORKDIR /app/apps/services/iam-service
EXPOSE 3000
ENV PATH="/go/bin:${PATH}"

RUN printf '#!/bin/sh\nset -e\nif [ ! -f .air.toml ]; then\n  if command -v air >/dev/null 2>&1; then\n    air init\n  fi\nfi\nexec air -c .air.toml\n' > /usr/local/bin/air-entrypoint.sh \
	&& chmod +x /usr/local/bin/air-entrypoint.sh

CMD ["/bin/sh", "/usr/local/bin/air-entrypoint.sh"]
