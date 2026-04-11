# =============================================================================
# IAM Service - Alpine Dockerfile
# =============================================================================

FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o iam-service \
    ./cmd/main.go

FROM builder AS dev
RUN go install github.com/air-verse/air@latest
ENV GOFLAGS="-mod=mod"
CMD ["air"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /app/iam-service .

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop \
    && chown -R gradeloop:gradeloop /app

USER gradeloop

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/iam-service", "health"]

ENV HOST=0.0.0.0

CMD ["./iam-service"]