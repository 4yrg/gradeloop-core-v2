# =============================================================================
# Email Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY docs/ ./docs/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o email-service \
    ./cmd/api

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/email-service .

EXPOSE 8082

CMD ["./email-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/email-service .

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop \
    && chown -R gradeloop:gradeloop /app

USER gradeloop

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/email-service", "health"]

ENV HOST=0.0.0.0

CMD ["./email-service"]