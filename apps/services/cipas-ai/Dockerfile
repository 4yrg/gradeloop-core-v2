# =============================================================================
# CIPAS AI Service - Slim Dockerfile
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
  curl \
  libpq-dev \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --pre -U pip wheel setuptools

# Copy shared packages first (from root context)
COPY packages/python/ ./packages/python/

COPY apps/services/cipas-ai/requirements.txt .
RUN pip install --no-cache-dir --no-warn-script-location -r requirements.txt

COPY apps/services/cipas-ai/src/ ./src/
COPY apps/services/cipas-ai/model/ ./model/

# Add packages to PYTHONPATH
ENV PYTHONPATH="${PYTHONPATH}:/app/packages/python"

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
# RUN groupadd -r cipas-ai && useradd -r -g cipas-ai cipas-ai

COPY --from=builder --chown=cipas-ai:cipas-ai /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=cipas-ai:cipas-ai /usr/local/bin /usr/local/bin
COPY --from=builder --chown=cipas-ai:cipas-ai /app/packages ./packages
COPY --from=builder --chown=cipas-ai:cipas-ai /app/src ./src
COPY --from=builder --chown=cipas-ai:cipas-ai /app/model ./model


ENV PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1 \
  PYTHONPATH="${PYTHONPATH}:/app/packages/python" \
  CIPAS_AI_MODEL_DIR=/app/model \
  CIPAS_AI_HOST=0.0.0.0 \
  CIPAS_AI_PORT=8104 \
  CIPAS_AI_DEVICE=cpu \
  CUDA_VISIBLE_DEVICES=""

EXPOSE 8104

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${CIPAS_AI_PORT:-8104}/api/v1/ai/ready || exit 1

CMD uvicorn src.main:app --host 0.0.0.0 --port ${CIPAS_AI_PORT:-8104}
