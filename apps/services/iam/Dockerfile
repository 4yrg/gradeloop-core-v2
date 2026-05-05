# =============================================================================
# IAM Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy shared packages first to leverage cache
COPY packages/go /app/packages/go

# Copy service specific files
COPY apps/services/iam/go.mod apps/services/iam/go.sum /app/apps/services/iam/
WORKDIR /app/apps/services/iam
RUN go mod download

COPY apps/services/iam/cmd/ ./cmd/
COPY apps/services/iam/internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o iam-service \
    ./cmd/main.go

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/apps/services/iam/iam-service .

EXPOSE 8081

CMD ["./iam-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/iam/iam-service .

USER gradeloop

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/iam-service", "health"]

ENV HOST=0.0.0.0

CMD ["./iam-service"]