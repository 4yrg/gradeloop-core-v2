# =============================================================================
# ACAFS Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    gcc \
    libpq-dev \
    g++ \
    && rm -rf /var/cache/apk/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --no-cache-dir poetry==1.7.1

COPY pyproject.toml poetry.lock* ./

RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

COPY app/ ./app/

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    curl \
    && rm -rf /var/cache/apk/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/app ./app

RUN addgroup -S acafs && adduser -S acafs -G acafs \
    && chown -R acafs:acafs /app

USER acafs

EXPOSE 8086

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8086/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8086"]

FROM builder AS development

WORKDIR /app

RUN poetry install --no-interaction --no-ansi --no-root

COPY app/ ./app/

EXPOSE 8086

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8086", "--reload"]