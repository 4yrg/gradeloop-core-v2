# =============================================================================
# ACAFS Service - Dockerfile
# =============================================================================
# Uses python:3.11-slim (Debian-based) instead of Alpine so that pre-built
# manylinux wheels are available for tree-sitter language bindings.
# Alpine (musl) lacks these wheels, forcing source compilation which fails
# because PEP 517 isolated builds cannot find the tree-sitter C headers.

FROM python:3.11-slim AS builder

WORKDIR /app

RUN if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g'; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev g++ \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --no-cache-dir poetry==1.7.1

COPY pyproject.toml poetry.lock* ./

RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

COPY app/ ./app/

FROM builder AS development

WORKDIR /app

RUN poetry install --no-interaction --no-ansi --no-root

COPY app/ ./app/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8102

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8102", "--reload"]

FROM python:3.11-slim AS production

WORKDIR /app

RUN if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g'; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/app ./app

RUN useradd -m acafs \
    && chown -R acafs:acafs /app

USER acafs

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8102

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8102/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8102"]