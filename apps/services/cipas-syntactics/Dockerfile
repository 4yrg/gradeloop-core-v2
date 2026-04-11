# =============================================================================
# CIPAS Syntactics Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    curl \
    git \
    && rm -rf /var/cache/apk/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

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

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    curl \
    && rm -rf /var/cache/apk/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/main.py /app/routes.py /app/schemas.py /app/database.py ./
COPY --from=builder /app/clone_detection ./clone_detection
COPY --from=builder /app/repositories ./repositories

RUN mkdir -p /app/models \
    && addgroup -S cipas-syntactics && adduser -S cipas-syntactics -G cipas-syntactics \
    && chown -R cipas-syntactics:cipas-syntactics /app

USER cipas-syntactics

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

EXPOSE 8106

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8106/api/v1/syntactics/health || exit 1

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${CIPAS_SYNTACTICS_PORT:-8106} --workers 1"]