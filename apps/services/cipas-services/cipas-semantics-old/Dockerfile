# =============================================================================
# CIPAS Semantics Old Service - Alpine Dockerfile
# =============================================================================

FROM python:3.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    git \
    && rm -rf /var/cache/apk/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY pyproject.toml ./

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    pydantic \
    tree-sitter \
    tree-sitter-java \
    tree-sitter-c \
    tree-sitter-c-sharp \
    tree-sitter-python \
    scikit-learn \
    xgboost \
    pandas \
    numpy \
    rapidfuzz \
    matplotlib \
    seaborn \
    plotly \
    tqdm

COPY main.py routes.py schemas.py ./
COPY clone_detection/ ./clone_detection/

RUN python -c "from clone_detection.tokenizers.tree_sitter_tokenizer import TreeSitterTokenizer; TreeSitterTokenizer(); print('Tree-sitter parsers loaded successfully')" 2>/dev/null || true

FROM python:3.11-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=""

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/main.py /app/routes.py /app/schemas.py ./
COPY --from=builder /app/clone_detection ./clone_detection

RUN mkdir -p /app/models \
    && addgroup -S cipas-semantics && adduser -S cipas-semantics -G cipas-semantics \
    && chown -R cipas-semantics:cipas-semantics /app

USER cipas-semantics

EXPOSE 8087

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8087/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8087", "--workers", "1"]

FROM builder AS development

WORKDIR /app

RUN apk add --no-cache python3-dev \
    && pip install pytest 2>/dev/null || true

COPY main.py routes.py schemas.py ./
COPY clone_detection/ ./clone_detection/

EXPOSE 8087

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8087", "--reload"]