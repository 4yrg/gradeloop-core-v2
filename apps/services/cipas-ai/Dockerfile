# =============================================================================
# CIPAS AI Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    curl \
    libpq-dev \
    && rm -rf /var/cache/apk/*

RUN pip install --no-cache-dir --pre -U pip wheel setuptools

COPY requirements.txt .
RUN pip install --no-cache-dir --no-warn-script-location -r requirements.txt

COPY src/ ./src/
COPY model/ ./model/

FROM builder AS development

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CIPAS_AI_MODEL_DIR=/app/model \
    CIPAS_AI_HOST=0.0.0.0 \
    CIPAS_AI_PORT=8104 \
    CIPAS_AI_DEVICE=cpu \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8104

CMD uvicorn src.main:app --host 0.0.0.0 --port ${CIPAS_AI_PORT:-8104} --reload

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    curl \
    && rm -rf /var/cache/apk/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/src ./src
COPY --from=builder /app/model ./model

RUN addgroup -S cipas-ai && adduser -S cipas-ai -G cipas-ai \
    && chown -R cipas-ai:cipas-ai /app

USER cipas-ai

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CIPAS_AI_MODEL_DIR=/app/model \
    CIPAS_AI_HOST=0.0.0.0 \
    CIPAS_AI_PORT=8104 \
    CIPAS_AI_DEVICE=cpu \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8104

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${CIPAS_AI_PORT:-8104}/api/v1/ai/ready || exit 1

CMD uvicorn src.main:app --host 0.0.0.0 --port ${CIPAS_AI_PORT:-8104}