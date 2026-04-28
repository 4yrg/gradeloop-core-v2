FROM docker.io/golang:1.25-alpine AS builder

WORKDIR /gradeloop

RUN apk add --no-cache git ca-certificates

COPY packages/go/notifier/ ./packages/go/notifier/
COPY apps/services/notification/go.mod apps/services/notification/go.sum ./apps/services/notification/

WORKDIR /gradeloop/apps/services/notification
RUN go mod download

COPY apps/services/notification/cmd/ ./cmd/
COPY apps/services/notification/internal/ ./internal/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -buildid=" \
    -trimpath \
    -o notification-service \
    ./cmd/main.go

FROM alpine:3.19 AS dev

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /gradeloop/apps/services/notification/notification-service .

EXPOSE 8086

CMD ["./notification-service"]

FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /gradeloop/apps/services/notification/notification-service .

RUN addgroup -S gradeloop && adduser -S gradeloop -G gradeloop \
    && chown -R gradeloop:gradeloop /app

USER gradeloop

EXPOSE 8086

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/notification-service", "health"]

ENV HOST=0.0.0.0

CMD ["./notification-service"]