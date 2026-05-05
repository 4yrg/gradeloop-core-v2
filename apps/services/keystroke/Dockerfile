# =============================================================================
# Keystroke Service - Optimized Slim Dockerfile
# =============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

# Combine apt-get and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN pip install --no-warn-script-location -r requirements.txt

# Development stage
FROM builder AS development
WORKDIR /app
COPY . .
ENV CUDA_VISIBLE_DEVICES=""
EXPOSE 8103
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8103", "--reload"]

# Production stage
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up non-root user
RUN groupadd -r keystroke && useradd -r -g keystroke keystroke

# Copy necessary files from builder with correct ownership
COPY --from=builder --chown=keystroke:keystroke /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=keystroke:keystroke /usr/local/bin /usr/local/bin

# Copy application files efficiently
COPY --chown=keystroke:keystroke main.py behavioral_analysis.py db.py feature_extraction.py redis_client.py typenet_inference.py requirements.txt schema.sql enrollment_tasks.json sample_session.json ./
COPY --chown=keystroke:keystroke models/ ./models/

USER keystroke

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8103

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8103/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8103"]
