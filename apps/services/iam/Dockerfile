# =============================================================================
# IAM Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

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

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/iam-service .

EXPOSE 8081

CMD ["./iam-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/iam-service .

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop \
    && chown -R gradeloop:gradeloop /app

USER gradeloop

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/iam-service", "health"]

ENV HOST=0.0.0.0

CMD ["./iam-service"]