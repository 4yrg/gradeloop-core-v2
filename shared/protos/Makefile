# Makefile for Protobuf generation

GOPATH ?= $(shell go env GOPATH)
BIN := $(GOPATH)/bin
BUF := $(BIN)/buf

.PHONY: all
all: install-tools lint generate

.PHONY: install-tools
install-tools:
	@echo "Installing tools..."
	go install github.com/bufbuild/buf/cmd/buf@latest
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	# Python tools are handled via remote plugins in buf.gen.yaml
	@echo "Tools installed."

.PHONY: lint
lint:
	$(BUF) lint

.PHONY: generate
generate:
	# Ensure the binary directory is in PATH so plugins can be found
	PATH=$(BIN):$$PATH $(BUF) generate

.PHONY: clean
clean:
	rm -rf ../gen/go/* ../gen/python/*

.PHONY: check-breaking
check-breaking:
	$(BUF) breaking --against ".git#branch=main"
