# =============================================================================
# CIPAS Semantics Service - Slim Dockerfile
# =============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

RUN if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
    fi \
    && if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

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

FROM python:3.11-slim AS production

WORKDIR /app

RUN if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
    fi \
    && if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/api ./api
COPY --from=builder /app/model ./model

RUN groupadd -r cipas-semantics && useradd -r -g cipas-semantics cipas-semantics \
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
    CMD python -c "import requests; requests.get('http://localhost:8105/api/v1/semantics/health', timeout=5)"

CMD uvicorn api.main:app --host 0.0.0.0 --port ${API_PORT:-8105}
