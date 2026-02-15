FROM golang:1.26

# Enviroment variable
WORKDIR /usr/src/some-api

RUN go install github.com/air-verse/air@latest

#Copying files to work directory
COPY go.mod ./
RUN go mod download && go mod verify
COPY . .

# Run and expose the server on port 3000
EXPOSE 3000

# Default command: use air for hot reload if available, otherwise run the Go service directly
CMD ["sh", "-c", "air cmd/main.go -b 0.0.0.0 || go run ./cmd/main.go"]
