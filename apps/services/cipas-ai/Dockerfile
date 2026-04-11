FROM python:3.11-alpine

WORKDIR /app

RUN apk add --no-cache \
    curl \
    libpq-dev \
    && rm -rf /var/cache/apk/*

RUN pip install --no-cache-dir --pre -U pip wheel setuptools

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY model/ ./model/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CIPAS_AI_MODEL_DIR=/app/model \
    CIPAS_AI_HOST=0.0.0.0 \
    CIPAS_AI_PORT=8085 \
    CIPAS_AI_DEVICE=cpu \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${CIPAS_AI_PORT:-8085}/api/v1/ai/ready || exit 1

CMD uvicorn src.main:app --host 0.0.0.0 --port ${CIPAS_AI_PORT:-8085}