# =============================================================================
# CIPAS XAI Service - Alpine Dockerfile
# =============================================================================

FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o cipas-xai ./cmd/main.go

FROM builder AS dev
RUN go install github.com/air-verse/air@latest
ENV GOFLAGS="-mod=mod"
CMD ["air"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/cipas-xai .
COPY --from=builder /app/.env.example .env

RUN addgroup -S cipas-xai && adduser -S cipas-xai -G cipas-xai \
    && chown -R cipas-xai:cipas-xai /app

USER cipas-xai

EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O - http://localhost:8085/health || exit 1

ENV HOST=0.0.0.0

CMD ["./cipas-xai"]