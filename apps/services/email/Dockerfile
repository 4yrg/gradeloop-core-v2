# =============================================================================
# Email Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy shared packages first to leverage cache
COPY packages/go /app/packages/go

# Copy service specific files
COPY apps/services/email/go.mod apps/services/email/go.sum /app/apps/services/email/
WORKDIR /app/apps/services/email
RUN go mod download

COPY apps/services/email/cmd/ ./cmd/
COPY apps/services/email/internal/ ./internal/
COPY apps/services/email/docs/ ./docs/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o email-service \
    ./cmd/api

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/apps/services/email/email-service .

EXPOSE 8082

CMD ["./email-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates

WORKDIR /app

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/email/email-service .

USER gradeloop

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/email-service", "health"]

ENV HOST=0.0.0.0

CMD ["./email-service"]