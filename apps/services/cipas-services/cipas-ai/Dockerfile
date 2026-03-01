# =============================================================================
# CIPAS AI - 2-Tier Hybrid Code Detection Service
# Multi-stage Dockerfile for production deployment
# =============================================================================

# =============================================================================
# Stage 1: Base Image with System Dependencies
# =============================================================================
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =============================================================================
# Stage 2: Builder - Install Python Dependencies
# =============================================================================
FROM base AS builder

# Install Poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml .

# Create virtual environment and install dependencies
RUN poetry config virtualenvs.create true \
    && poetry config virtualenvs.in-project true \
    && poetry install --no-interaction --no-ansi --no-root \
    && poetry install --no-interaction --no-ansi --extras async

# =============================================================================
# Stage 3: Tree-sitter Parser Builder
# =============================================================================
FROM base AS parser-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    cargo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /parsers

# Clone and build tree-sitter parsers
RUN git clone --depth 1 https://github.com/tree-sitter/tree-sitter-python.git \
    && git clone --depth 1 https://github.com/tree-sitter/tree-sitter-java.git \
    && git clone --depth 1 https://github.com/tree-sitter/tree-sitter-c.git \
    && git clone --depth 1 https://github.com/tree-sitter/tree-sitter-cpp.git

# Build parsers
WORKDIR /parsers/tree-sitter-python
RUN python setup.py build

WORKDIR /parsers/tree-sitter-java
RUN python setup.py build

WORKDIR /parsers/tree-sitter-c
RUN python setup.py build

WORKDIR /parsers/tree-sitter-cpp
RUN python setup.py build

# =============================================================================
# Stage 4: Runtime - Production Image
# =============================================================================
FROM base AS runtime

# Create non-root user for security
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY --from=builder --chown=appuser:appgroup . /app/
COPY --chown=appuser:appgroup . /app/

# Copy built parsers
COPY --from=parser-builder /parsers/tree-sitter-python/build/Release/*.so /app/models/
COPY --from=parser-builder /parsers/tree-sitter-java/build/Release/*.so /app/models/
COPY --from=parser-builder /parsers/tree-sitter-c/build/Release/*.so /app/models/
COPY --from=parser-builder /parsers/tree-sitter-cpp/build/Release/*.so /app/models/

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app:$PYTHONPATH" \
    CIPAS_AI_GRAMMAR_PATH="/app/models" \
    CIPAS_AI_TIER1_MODEL_PATH="/app/models/catboost_classifier.cbm"

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8087/health || exit 1

# Entry point
ENTRYPOINT ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8087"]

# Default command (can be overridden)
CMD ["--workers", "1"]

# =============================================================================
# Stage 5: Development Image (optional)
# =============================================================================
FROM runtime AS dev

# Switch back to root for installing dev dependencies
USER root

# Install dev dependencies
RUN poetry install --no-interaction --no-ansi --with dev

# Switch back to non-root user
USER appuser

# Enable reload for development
CMD ["--reload", "--workers", "1"]
