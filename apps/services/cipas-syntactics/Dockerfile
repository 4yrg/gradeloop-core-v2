# =============================================================================
# CIPAS Syntactics Service - Slim Dockerfile
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
    build-essential \
    curl \
    git \
    cmake \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y nvidia-nccl-cu12 nvidia-cuda-runtime-cu12 nvidia-cudnn-cu12 nvidia-cublas-cu12 \
       nvidia-cuda-cupti-cu12 nvidia-cuda-nvrtc-cu12 nvidia-curand-cu12 nvidia-cusolver-cu12 \
       nvidia-cusparse-cu12 nvidia-npp-cu12 nvidia-nvjitlink-cu12 nvidia-nvtx-cu12 || true \
    && find /usr/local/lib/python3.11/site-packages -name "*.pyc" -delete \
    && find /usr/local/lib/python3.11/site-packages -name "__pycache__" -delete

COPY main.py routes.py schemas.py database.py ./
COPY clone_detection/ ./clone_detection/
COPY repositories/ ./repositories/

RUN python -c "from clone_detection.tokenizers.tree_sitter_tokenizer import TreeSitterTokenizer; TreeSitterTokenizer(); print('Tree-sitter parsers loaded successfully')" 2>/dev/null || true

FROM builder AS development

WORKDIR /app

COPY main.py routes.py schemas.py database.py ./
COPY clone_detection/ ./clone_detection/
COPY repositories/ ./repositories/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8106

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8106", "--reload"]

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
COPY --from=builder /app/main.py /app/routes.py /app/schemas.py /app/database.py ./
COPY --from=builder /app/clone_detection ./clone_detection
COPY --from=builder /app/repositories ./repositories

RUN mkdir -p /app/models \
    && groupadd -r cipas-syntactics && useradd -r -g cipas-syntactics cipas-syntactics \
    && chown -R cipas-syntactics:cipas-syntactics /app

USER cipas-syntactics

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8106

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8106/api/v1/syntactics/health || exit 1

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${CIPAS_SYNTACTICS_PORT:-8106} --workers 1"]
