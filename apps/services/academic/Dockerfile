# =============================================================================
# Academic Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy shared packages first to leverage cache
COPY packages/go /app/packages/go

# Copy service specific files
COPY apps/services/academic/go.mod apps/services/academic/go.sum /app/apps/services/academic/
WORKDIR /app/apps/services/academic
RUN go mod download

COPY apps/services/academic/cmd/ ./cmd/
COPY apps/services/academic/internal/ ./internal/
COPY apps/services/academic/docs/ ./docs/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o academic-service \
    ./cmd/main.go

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/apps/services/academic/academic-service .

EXPOSE 8083

CMD ["./academic-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/academic/academic-service .

USER gradeloop

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/academic-service", "health"]

ENV HOST=0.0.0.0

CMD ["./academic-service"]