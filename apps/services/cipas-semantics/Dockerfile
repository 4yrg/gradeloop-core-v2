# =============================================================================
# CIPAS Semantics Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    git \
    libpq-dev \
    && rm -rf /var/cache/apk/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY model/ ./model/

FROM builder AS development

WORKDIR /app

COPY api/ ./api/
COPY model/ ./model/

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEVICE=cpu
ENV USE_CUDA=false
ENV API_PORT=8105

EXPOSE 8105

CMD uvicorn api.main:app --host 0.0.0.0 --port ${API_PORT:-8105} --reload

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    curl \
    && rm -rf /var/cache/apk/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/api ./api
COPY --from=builder /app/model ./model

RUN addgroup -S cipas-semantics && adduser -S cipas-semantics -G cipas-semantics \
    && chown -R cipas-semantics:cipas-semantics /app

USER cipas-semantics

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEVICE=cpu
ENV USE_CUDA=false
ENV API_PORT=8105
ENV PYTHONPATH=/app

EXPOSE 8105

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8105/api/v1/health', timeout=5)"

CMD uvicorn api.main:app --host 0.0.0.0 --port ${API_PORT:-8105}