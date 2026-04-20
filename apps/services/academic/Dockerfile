# =============================================================================
# Academic Service - Alpine Dockerfile
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
    -o academic-service \
    ./cmd/main.go

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/academic-service .

EXPOSE 8083

CMD ["./academic-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/academic-service .

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop \
    && chown -R gradeloop:gradeloop /app

USER gradeloop

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/academic-service", "health"]

ENV HOST=0.0.0.0

CMD ["./academic-service"]