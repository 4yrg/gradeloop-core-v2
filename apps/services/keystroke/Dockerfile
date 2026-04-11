# =============================================================================
# Keystroke Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/cache/apk/*

COPY requirements.txt .
RUN pip install --no-cache-dir --no-warn-script-location -r requirements.txt

FROM builder AS development

WORKDIR /app

COPY . .

RUN mkdir -p /app/models

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8103

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8103", "--reload"]

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    curl \
    && rm -rf /var/cache/apk/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .

RUN mkdir -p /app/models \
    && addgroup -S keystroke && adduser -S keystroke -G keystroke \
    && chown -R keystroke:keystroke /app

USER keystroke

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8103

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8103/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8103"]