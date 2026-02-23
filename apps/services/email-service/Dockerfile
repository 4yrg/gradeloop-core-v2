FROM golang:alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
COPY vendor ./vendor

COPY . .

RUN go build -mod=vendor -o email-service ./cmd/api

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/email-service .


EXPOSE 8082

CMD ["./email-service"]
