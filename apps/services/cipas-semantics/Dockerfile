FROM python:3.11-alpine

WORKDIR /app

RUN apk add --no-cache \
    git \
    libpq-dev \
    && rm -rf /var/cache/apk/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY model/ ./model/

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEVICE=cpu
ENV USE_CUDA=false
ENV API_PORT=8087
ENV CUDA_VISIBLE_DEVICES=""

EXPOSE 8087

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8087/api/v1/health', timeout=5)"

CMD uvicorn api.main:app --host 0.0.0.0 --port ${API_PORT:-8087}