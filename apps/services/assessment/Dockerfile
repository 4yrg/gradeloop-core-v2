# =============================================================================
# Assessment Service - Alpine Dockerfile
# =============================================================================

FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy shared packages first to leverage cache
COPY packages/go /app/packages/go

# Copy service specific files
COPY apps/services/assessment/go.mod apps/services/assessment/go.sum /app/apps/services/assessment/
WORKDIR /app/apps/services/assessment
RUN go mod download

COPY apps/services/assessment/cmd/ ./cmd/
COPY apps/services/assessment/internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o assessment-service \
    ./cmd/main.go

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/apps/services/assessment/assessment-service .

EXPOSE 8084

CMD ["./assessment-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop

COPY --from=builder --chown=gradeloop:gradeloop /app/apps/services/assessment/assessment-service .

USER gradeloop

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/assessment-service", "health"]

ENV HOST=0.0.0.0

CMD ["./assessment-service"]