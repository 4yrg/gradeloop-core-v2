# =============================================================================
# IVAS Service - Optimized Slim Dockerfile
# =============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

# Combine apt-get commands and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Install Poetry
RUN pip install poetry==1.8.2

COPY pyproject.toml poetry.lock* ./

# Configure poetry and install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

# Pre-download the Resemblyzer voice encoder model to a specific path
RUN mkdir -p /app/model_cache && \
    export XDG_CACHE_HOME=/app/model_cache && \
    python -c "from resemblyzer import VoiceEncoder; VoiceEncoder()"

COPY app/ ./app/

# Development stage
FROM builder AS development
WORKDIR /app
RUN poetry install --no-interaction --no-ansi --no-root
ENV CUDA_VISIBLE_DEVICES=""
EXPOSE 8101
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101", "--reload"]

# Production stage
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime dependencies and clean up in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libsndfile1 \
    libopenblas0 \
    libsoxr0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up non-root user
RUN groupadd --system ivas && useradd --system --gid ivas ivas

# Copy python packages from builder
COPY --from=builder --chown=ivas:ivas /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=ivas:ivas /usr/local/bin /usr/local/bin
COPY --from=builder --chown=ivas:ivas /app/app ./app

# Copy ONLY the model cache
COPY --from=builder --chown=ivas:ivas /app/model_cache /home/ivas/.cache

USER ivas

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES="" \
    HOME=/home/ivas \
    XDG_CACHE_HOME=/home/ivas/.cache

EXPOSE 8101

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8101/api/v1/ivas/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
