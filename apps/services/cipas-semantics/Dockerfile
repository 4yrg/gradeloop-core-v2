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
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy shared packages first (from root context)
COPY packages/python/ ./packages/python/

COPY apps/services/cipas-semantics/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY apps/services/cipas-semantics/api/ ./api/
COPY apps/services/cipas-semantics/model/ ./model/

FROM builder AS development

WORKDIR /app

COPY apps/services/cipas-semantics/api/ ./api/
COPY apps/services/cipas-semantics/model/ ./model/

ENV PYTHONPATH=/app:/app/packages/python
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

# Set up non-root user
RUN groupadd -r cipas-semantics && useradd -r -g cipas-semantics cipas-semantics

# Copy only necessary files with correct ownership
COPY --from=builder --chown=cipas-semantics:cipas-semantics /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=cipas-semantics:cipas-semantics /usr/local/bin /usr/local/bin
COPY --from=builder --chown=cipas-semantics:cipas-semantics /app/packages ./packages
COPY --from=builder --chown=cipas-semantics:cipas-semantics /app/api ./api
COPY --from=builder --chown=cipas-semantics:cipas-semantics /app/model ./model

USER cipas-semantics

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEVICE=cpu
ENV USE_CUDA=false
ENV API_PORT=8105
ENV PYTHONPATH=/app:/app/packages/python

EXPOSE 8105

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8105/api/v1/semantics/health || exit 1

CMD uvicorn api.main:app --host 0.0.0.0 --port ${API_PORT:-8105}
