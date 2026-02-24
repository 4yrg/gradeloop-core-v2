# CIPAS Syntactic Normalization Pipeline

**Document:** E10/US02 — Syntactic Normalization Pipeline for Type 1 and Type 2 Clone Detection  
**Status:** Implemented  
**Service:** `apps/services/cipas-service`  
**Authors:** Platform Engineering  
**Last Updated:** 2025-07-18  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Type 1 Pipeline](#3-type-1-pipeline)
4. [Type 2 Pipeline](#4-type-2-pipeline)
5. [API Reference](#5-api-reference)
6. [Configuration](#6-configuration)
7. [Redis Integration](#7-redis-integration)
8. [Observability & Metrics](#8-observability--metrics)
9. [Performance](#9-performance)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Testing](#11-testing)
12. [Module Reference](#12-module-reference)

---

## 1. Overview

The CIPAS Syntactic Normalization Pipeline (Track A) prepares extracted code granules for high-precision clone detection by eliminating superficial source differences that would otherwise mask true structural similarity.

Two clone types are targeted:

| Clone Type | Definition | Detection Method |
|---|---|---|
| **Type 1** | Literal copies differing only in whitespace, comments, and formatting | Strip cosmetics → pretty-print → compare `hash_type1` |
| **Type 2** | Structurally identical code with renamed identifiers and/or changed literals | Type-1 processing + canonicalize identifiers/literals → compare `hash_type2` |

### Pipeline Position

```
E15/US07                  E10/US02                   E15/US09
Granule Extraction  →  Normalization Pipeline  →  Similarity Scoring
(tree-sitter CST)       (Strip + Format +          (hash comparison /
                          Canonicalize)              vector embedding)
```

The pipeline accepts granules produced by the ingestion layer and publishes normalized results to Redis for downstream similarity scoring.

---

## 2. Architecture

### 2.1 High-Level Design

```
HTTP POST /api/v1/cipas/normalize
              │
              ▼
  ┌───────────────────────┐
  │   NormalizationService │  (async, FastAPI event loop)
  │                        │
  │  ┌──────────────────┐  │
  │  │  Redis GET cache  │  │──► Cache HIT: return immediately
  │  └──────────────────┘  │
  │           │ miss        │
  │           ▼             │
  │  ┌──────────────────┐  │
  │  │ ProcessPoolExecutor│ │──► run_normalization_worker()
  │  └──────────────────┘  │         │
  │           │             │    ┌───▼────────────────────┐
  │           │             │    │  Worker Process (CPU)   │
  │           │             │    │  Step A: Type-1         │
  │           │             │    │    strip_comments()     │
  │           │             │    │    format_source()      │
  │           │             │    │    sha256(type1)        │
  │           │             │    │  Step B: Type-2         │
  │           │             │    │    canonicalize()       │
  │           │             │    │    sha256(type2)        │
  │           │             │    └────────────────────────┘
  │           │             │
  │  ┌──────────────────┐  │
  │  │  Redis SET (TTL)  │  │
  │  └──────────────────┘  │
  └───────────────────────┘
              │
              ▼
  NormalizedResult { type1, type2, hash_type1, hash_type2 }
```

### 2.2 Concurrency Model

- The FastAPI event loop thread handles HTTP I/O and Redis I/O asynchronously.
- All CPU-bound normalization work (tree-sitter parsing, subprocess formatters, SHA-256 hashing) runs in a `ProcessPoolExecutor` off the event loop.
- A `asyncio.Semaphore` bounded by `NORMALIZATION_BATCH_SIZE` prevents OOM from concurrent large batches.
- Worker processes are pre-warmed at startup via `_normalization_worker_init()` to amortize grammar load and formatter probe cost.

### 2.3 Lifecycle

```python
# main.py lifespan (startup)
normalization_service = NormalizationService(settings=settings)
await normalization_service.start()      # spawns ProcessPoolExecutor + Redis pool
app.state.normalization_service = normalization_service

# main.py lifespan (shutdown)
await normalization_service.stop()       # drains in-flight tasks, closes Redis
```

---

## 3. Type 1 Pipeline

Type 1 normalization produces a deterministic, whitespace-normalized source text by removing all cosmetic differences.

### 3.1 Steps

```
source_bytes (UTF-8)
      │
      ▼  Step 1: CST Comment/Docstring Stripping
      │  CSTStripper (stripper.py)
      │  • tree-sitter parse → CST node traversal
      │  • Collect comment/docstring byte spans
      │  • Excise spans → post-process whitespace
      │
      ▼  Step 2: Pretty Printing
      │  PrettyPrinter (pretty_printer.py)
      │  • Python → black (≥24.x, --quiet --fast --line-length 88)
      │  • Java   → google-java-format (--aosp, stdin mode)
      │  • C      → clang-format (BasedOnStyle: GNU, IndentWidth: 4)
      │  • Fallback: stripped text if formatter unavailable/times out
      │
      ▼  Step 3: SHA-256 Hash
         hash_type1 = sha256(utf8(formatted_text))
```

### 3.2 Comment Stripping: Language Rules

| Language | Stripped Node Types |
|---|---|
| Python | `comment` nodes + first-statement `expression_statement` string nodes (docstrings) |
| Java | `line_comment` nodes + `block_comment` nodes (including Javadoc `/** ... */`) |
| C | `comment` nodes (tree-sitter C grammar unifies `//` and `/* */` under one type) |

The stripping is **CST-based**, not regex-based. This ensures correctness in edge cases like string literals that contain `//` or `#` characters, and multi-line block comments that span function boundaries.

### 3.3 Pretty Printing: Formatter Details

#### Python → `black`
```bash
black --quiet --fast --line-length 88 --target-version py311 -
```
- Enforces single-quote strings, trailing commas, consistent indentation.
- Version pinned via `BLACK_VERSION_PREFIX` (default: `"24."`) to prevent non-determinism from black version upgrades.

#### Java → `google-java-format`
```bash
java -jar google-java-format.jar --aosp -
```
- AOSP style: 4-space indentation (closer to common student code style than the default 2-space Google style).
- Requires a JAR at the path configured by `JAVA_FORMATTER_JAR`. If unset, falls back to stripped text.

#### C → `clang-format`
```bash
clang-format --style="{BasedOnStyle: GNU, IndentWidth: 4, TabWidth: 4, UseTab: Never, BreakBeforeBraces: Linux, ...}"
```
- GNU/K&R style: braces on same line for functions, 4-space indentation.
- Optional major version pin via `CLANG_FORMAT_MAJOR_VERSION` (default: `0` = disabled).

### 3.4 Fallback Behavior

If a formatter subprocess times out (2 s), exits non-zero, or the binary is not installed:
- The stripped text (Step 1 output) is used as `type1` verbatim.
- A `cipas_normalization_formatter_fallback_total` Prometheus counter is incremented.
- A `WARNING` log is emitted but no exception is raised.
- `hash_type1` is computed over the fallback text, so it is still deterministic.

---

## 4. Type 2 Pipeline

Type 2 normalization runs on the Type 1 output and replaces all user-defined identifiers and literals with deterministic canonical tokens.

### 4.1 Steps

```
type1_text (from Type 1 pipeline)
      │
      ▼  Step 1+2: Identifier and Literal Canonicalization (single CST walk)
      │  Canonicalizer (canonicalizer.py)
      │  • tree-sitter parse(type1_text)
      │  • DFS pre-order traversal with explicit stack
      │  • Per-node classification:
      │      Literal node       → LIT_<sha1_6hex>
      │      Identifier (user)  → FUNC_N / PARAM_N / VAR_N
      │      Keyword / built-in → preserved unchanged
      │  • Collect (start_byte, end_byte, replacement) substitutions
      │  • Reconstruct source text with substitutions applied
      │
      ▼  Step 3: SHA-256 Hash
         hash_type2 = sha256(utf8(canonical_text))
```

### 4.2 Identifier Canonicalization

Identifiers are classified into three semantic categories and replaced with indexed tokens:

| Category | Token Pattern | Trigger |
|---|---|---|
| Function names | `FUNC_1`, `FUNC_2`, … | Identifier in function/method definition position |
| Parameters | `PARAM_1`, `PARAM_2`, … | Identifier in formal parameter position |
| Variables | `VAR_1`, `VAR_2`, … | All other user-defined identifiers |

**Ordering contract**: Tokens are assigned in DFS pre-order (left-to-right, top-to-bottom). The first user-defined function name encountered becomes `FUNC_1`, the first parameter becomes `PARAM_1`, etc.

**First-encounter wins**: If a name is used first as a function and later as a variable, it retains the `FUNC_N` token throughout.

**Preserved names**: Language keywords and well-known built-ins are never replaced:
- Python: `None`, `True`, `False`, `print`, `range`, `len`, `int`, `str`, `list`, …
- Java: `void`, `int`, `String`, `System`, `Object`, `null`, `true`, `false`, …
- C: `int`, `void`, `char`, `NULL`, `printf`, `malloc`, `free`, `sizeof`, …

#### Example (Java)

Input (Type 1 output):
```java
void loop() {
    for (int count = 0; count < 10; count++) {
        System.out.println(count);
    }
}
```

Type 2 output:
```java
void FUNC_1() {
    for (int VAR_1 = LIT_77af6e; VAR_1 < LIT_3c59dc; VAR_1++) {
        System.out.println(VAR_1);
    }
}
```

Both `count` and `idx` (renamed variant) produce `VAR_1`, making them **Type 2 clones** (`hash_type2` is identical).

### 4.3 Literal Canonicalization

All numeric, string, boolean, and character literals are replaced with a `LIT_<sha1_6hex>` token:

```
token = "LIT_" + sha1(raw_literal_text.encode("utf-8")).hexdigest()[:6]
```

- The same literal value always maps to the same token (deterministic).
- Different literal values produce different tokens (sha1 collision negligible at 6 hex chars for typical code).
- The raw text of the literal node (including quotes, type suffixes, etc.) is hashed, so `42`, `42L`, and `42.0` produce different tokens.

#### Literal Node Types by Language

| Language | Literal Node Types |
|---|---|
| Python | `integer`, `float`, `string`, `true`, `false`, `none` |
| Java | `decimal_integer_literal`, `floating_point_literal`, `string_literal`, `character_literal`, `boolean_type` values |
| C | `number_literal`, `string_literal`, `char_literal` |

### 4.4 Language-Specific Classification

The CST walker dispatches to language-specific child classifiers:

- **`_classify_python_children`**: Recognizes `function_definition`, `parameters`, assignment targets, for-loop variables.
- **`_classify_java_children`**: Recognizes `method_declaration`, `constructor_declaration`, `formal_parameters`, local variable declarations.
- **`_classify_c_children`**: Recognizes `function_definition`, `parameter_declaration`, declarators within `declaration` nodes.

---

## 5. API Reference

### 5.1 POST `/api/v1/cipas/normalize`

Normalize a single code granule through the full Type 1 + Type 2 pipeline.

**Request Body** (`application/json`):

```json
{
  "granule_id": "550e8400-e29b-41d4-a716-446655440000",
  "language": "python",
  "source_text": "def add(a, b):\n    # adds two numbers\n    return a + b\n"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `granule_id` | `string` | Yes | Opaque identifier (UUID or composite key). Drives Redis cache key. Max 512 chars. |
| `language` | `string` | Yes | Source language: `python`, `java`, or `c` (case-insensitive). |
| `source_text` | `string` | Yes | Decoded UTF-8 source code of the granule. Must be non-empty. |

**Response** (`200 OK`):

```json
{
  "granule_id": "550e8400-e29b-41d4-a716-446655440000",
  "language": "python",
  "type1": "def add(a, b):\n    return a + b\n",
  "type2": "def FUNC_1(PARAM_1, PARAM_2):\n    return PARAM_1 + PARAM_2\n",
  "hash_type1": "a1b2c3d4e5f6...  (64 hex chars)",
  "hash_type2": "f6e5d4c3b2a1...  (64 hex chars)",
  "normalized_at": "2024-06-01T12:34:56.789012+00:00",
  "processing_ms": 42.7
}
```

| Field | Type | Description |
|---|---|---|
| `granule_id` | `string` | Echoed from request. |
| `language` | `string` | Echoed from request. |
| `type1` | `string` | Type 1 normalized source (comments stripped, pretty-printed). |
| `type2` | `string` | Type 2 normalized source (Type 1 + identifier/literal canonicalization). |
| `hash_type1` | `string` | SHA-256 hex digest of `type1` (64 lowercase hex chars). |
| `hash_type2` | `string` | SHA-256 hex digest of `type2` (64 lowercase hex chars). |
| `normalized_at` | `string` | ISO-8601 UTC timestamp when normalization completed. |
| `processing_ms` | `float` | Wall-clock time for the entire request in milliseconds. |

**Error Responses**:

| Status | Condition |
|---|---|
| `422 Unprocessable Entity` | Invalid `language`, blank `granule_id`, empty `source_text`, or missing required field. |
| `500 Internal Server Error` | Worker timeout, worker crash, or canonicalization failure. Body contains `stage` field indicating which pipeline step failed. |
| `503 Service Unavailable` | `NormalizationService` is not initialized (still warming up or startup failed). |

---

### 5.2 POST `/api/v1/cipas/normalize/batch`

Normalize a batch of granules concurrently.

**Request Body** (`application/json`):

```json
{
  "granules": [
    {
      "granule_id": "g-001",
      "language": "python",
      "source_text": "def f(x):\n    return x\n"
    },
    {
      "granule_id": "g-002",
      "language": "java",
      "source_text": "int f(int x) { return x; }"
    }
  ]
}
```

**Response** (`200 OK`):

```json
{
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "processing_ms": 88.3,
  "results": [
    { "granule_id": "g-001", "language": "python", "type1": "...", "type2": "...", "hash_type1": "...", "hash_type2": "...", "normalized_at": "...", "processing_ms": 88.3 },
    { "granule_id": "g-002", "language": "java",   "type1": "...", "type2": "...", "hash_type1": "...", "hash_type2": "...", "normalized_at": "...", "processing_ms": 88.3 }
  ]
}
```

**Batch size limit**: Controlled by `NORMALIZATION_BATCH_SIZE` (default: `64`). Requests exceeding the limit return `422`.

**Partial failure**: Failed granules appear as `null` in `results`. The `failed` counter reflects the count. Remaining successful results are always returned.

---

### 5.3 GET `/api/v1/cipas/normalize/health`

Check the health of the `NormalizationService` sub-system.

**Response** (`200 OK` — healthy):

```json
{
  "status": "ok",
  "executor_ok": true,
  "redis_ok": true,
  "worker_count": 4,
  "pending_tasks": 0
}
```

Returns `503 Service Unavailable` with `"status": "degraded"` if the `ProcessPoolExecutor` is broken or Redis is unreachable.

---

## 6. Configuration

All settings are read from environment variables with the `CIPAS_` prefix (via `pydantic-settings`).

| Environment Variable | Default | Description |
|---|---|---|
| `CIPAS_NORMALIZATION_WORKERS` | `0` (= `os.cpu_count()`) | Number of `ProcessPoolExecutor` worker processes for the normalization pipeline. |
| `CIPAS_NORMALIZATION_TASK_TIMEOUT` | `10.0` | Per-granule normalization timeout in seconds (`asyncio.wait_for`). |
| `CIPAS_NORMALIZATION_BATCH_SIZE` | `64` | Maximum granules per `normalize_batch()` invocation. |
| `CIPAS_NORMALIZATION_TTL_SECONDS` | `3600` | Redis TTL for cached normalized results (1 hour). |
| `CIPAS_REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL. Supports `redis://`, `rediss://` (TLS), `unix://`. |
| `CIPAS_JAVA_FORMATTER_JAR` | `""` | Absolute path to `google-java-format` JAR. Empty string disables Java pretty-printing. |
| `CIPAS_BLACK_VERSION_PREFIX` | `"24."` | Expected `black` version prefix. Empty string disables version pinning. |
| `CIPAS_CLANG_FORMAT_MAJOR_VERSION` | `0` | Expected `clang-format` major version (e.g. `17`). `0` disables version pinning. |
| `CIPAS_WORKER_MAX_TASKS_PER_CHILD` | `500` | Recycle worker processes after this many tasks to prevent RSS growth. |

### 6.1 Local Development (`.env`)

```dotenv
CIPAS_ENV=development
CIPAS_REDIS_URL=redis://localhost:6379/0
CIPAS_NORMALIZATION_WORKERS=2
CIPAS_JAVA_FORMATTER_JAR=/opt/google-java-format.jar
CIPAS_BLACK_VERSION_PREFIX=24.
CIPAS_CLANG_FORMAT_MAJOR_VERSION=0
```

### 6.2 Production Recommendations

```dotenv
CIPAS_ENV=production
CIPAS_NORMALIZATION_WORKERS=4        # match container CPU quota
CIPAS_NORMALIZATION_TASK_TIMEOUT=5.0 # tighter SLO
CIPAS_NORMALIZATION_TTL_SECONDS=3600
CIPAS_REDIS_URL=rediss://:<password>@redis-prod:6380/0
CIPAS_JAVA_FORMATTER_JAR=/opt/tools/google-java-format-1.22.0-all-deps.jar
CIPAS_BLACK_VERSION_PREFIX=24.
CIPAS_CLANG_FORMAT_MAJOR_VERSION=17
CIPAS_WORKER_MAX_TASKS_PER_CHILD=500
```

---

## 7. Redis Integration

### 7.1 Key Schema

```
cipas:normalized:{granule_id}
```

- **TTL**: `NORMALIZATION_TTL_SECONDS` (default 1 hour).
- **Value**: JSON-serialized `NormalizedResult` payload.
- **Encoding**: UTF-8 JSON string stored as a Redis `STRING`.

### 7.2 Payload Format

```json
{
  "granule_id": "abc-123",
  "language": "python",
  "type1": "...",
  "type2": "...",
  "hash_type1": "a1b2...",
  "hash_type2": "f6e5...",
  "normalized_at": "2024-06-01T12:00:00+00:00"
}
```

### 7.3 Cache Operations

| Operation | Command | Description |
|---|---|---|
| Single read | `GET cipas:normalized:{id}` | Cache check before worker dispatch. |
| Single write | `SET cipas:normalized:{id} <json> EX <ttl>` | Publish result after normalization. |
| Batch read | `MGET cipas:normalized:{id1} cipas:normalized:{id2} …` | One round-trip for entire batch cache check. |
| Batch write | Redis pipeline (`SET` × N) | One round-trip to publish all batch results. |

### 7.4 Cache Failure Behavior

Redis failures are **non-fatal**:
- A cache read failure is treated as a cache miss — normalization proceeds normally.
- A cache write failure is logged at `WARNING` — the `NormalizedResult` is still returned to the caller.
- No exception propagates to the HTTP layer for Redis errors.

---

## 8. Observability & Metrics

All metrics are exposed at `GET /metrics` (Prometheus format).

### 8.1 Counters

| Metric | Labels | Description |
|---|---|---|
| `cipas_normalization_granules_total` | `language`, `status` | Total granules processed (`status`: `success` / `error`). |
| `cipas_normalization_errors_total` | `language`, `stage` | Errors per pipeline stage (`cst_strip`, `pretty_print`, `canonicalize_identifiers`, etc.). |
| `cipas_normalization_formatter_fallback_total` | `language`, `formatter` | Formatter fallback invocations (formatter unavailable/timeout). |
| `cipas_normalization_redis_ops_total` | `operation`, `status` | Redis operations (`get`, `set`, `mget`, `pipeline_set`) with `success`/`error`. |
| `cipas_normalization_cache_result_total` | `language`, `result` | Cache hits (`hit`) and misses (`miss`). |

### 8.2 Histograms

| Metric | Labels | Description |
|---|---|---|
| `cipas_normalization_duration_seconds` | `language`, `pipeline` | Per-granule wall-clock latency. SLO: p99 ≤ 100ms at 500 LOC. |
| `cipas_normalization_batch_size` | — | Distribution of `normalize_batch()` call sizes. |
| `cipas_normalization_type1_bytes` | `language` | Type 1 output text size distribution in bytes. |
| `cipas_normalization_type2_bytes` | `language` | Type 2 output text size distribution in bytes. |

### 8.3 Gauges

| Metric | Labels | Description |
|---|---|---|
| `cipas_normalization_worker_queue_depth` | — | Number of normalization tasks currently in-flight in the executor. High values indicate saturation. |

### 8.4 Structured Logging

All normalization events are logged via `loguru` in JSON format. Key log fields:

```json
{
  "event": "Granule normalised",
  "granule_id": "abc-123",
  "language": "python",
  "elapsed_ms": 38.5,
  "hash_type1": "a1b2c3d4e5f6",
  "hash_type2": "f6e5d4c3b2a1"
}
```

---

## 9. Performance

### 9.1 SLO

| Metric | Target |
|---|---|
| Per-granule latency (500 LOC) | ≤ 100ms wall-clock |
| Type 1 detection accuracy | 100% for literal copies (after normalization) |
| Type 2 detection accuracy | ≥ 95% for renamed-identifier clones |

### 9.2 Benchmark Harness

Run the performance benchmarks with:

```bash
cd apps/services/cipas-service

# Statistical benchmark (requires pytest-benchmark)
poetry run pytest tests/benchmarks/test_normalization_perf.py -v --benchmark-sort=mean

# Quick timing assertions only (no benchmark harness, suitable for CI)
poetry run pytest tests/benchmarks/test_normalization_perf.py -v -k "latency"
```

The benchmark suite includes:
- `TestType1PipelinePerformance` — strip + format per language (Python, Java, C)
- `TestType2PipelinePerformance` — canonicalization per language
- `TestFullPipelinePerformance` — combined Type 1 + Type 2 per language
- `test_mixed_language_batch_throughput` — throughput across 3 languages concurrently

### 9.3 Performance Characteristics

| Stage | Typical Latency (500 LOC) | Dominant Cost |
|---|---|---|
| CST comment stripping | 2–5ms | tree-sitter C parse |
| Python formatting (`black`) | 20–50ms | subprocess spawn + black parse |
| Java formatting (`google-java-format`) | 30–80ms | JVM startup (mitigated by JAR cache) |
| C formatting (`clang-format`) | 5–20ms | subprocess spawn + LLVM parse |
| Identifier canonicalization | 3–8ms | second tree-sitter pass |
| SHA-256 hashing | < 1ms | CPU-bound, negligible |

**Total (Python, no JVM cold start)**: typically 30–70ms at 500 LOC, well within the 100ms SLO.

### 9.4 Optimization Notes

- **Worker pre-warming**: `_normalization_worker_init()` loads all tree-sitter grammars and probes formatter versions once per worker process at pool startup, not on the first granule.
- **Formatter subprocess**: The `black` and `clang-format` binaries start fresh for each granule (no persistent daemon). The JVM for `google-java-format` has a ~100ms cold-start penalty on the first call per worker; subsequent calls reuse the OS page cache.
- **Redis MGET**: Batch cache lookups use a single `MGET` command to minimize round-trip latency, regardless of batch size.
- **Semaphore bounding**: `asyncio.Semaphore(NORMALIZATION_BATCH_SIZE)` prevents OOM when large batches arrive faster than workers can process them.

---

## 10. Edge Cases & Error Handling

### 10.1 Empty Granules

- **Source text with only whitespace**: The CST stripper returns an empty string after post-processing. The canonicalizer returns the empty string unchanged. `hash_type1 == hash_type2 == sha256("")`.
- **Behavior**: Logged at `DEBUG` level ("empty source after stripping"). No worker slot is wasted because the worker returns immediately.

### 10.2 Syntax Errors in Granules

- **tree-sitter always returns a partial tree** — it never throws an exception on invalid syntax.
- The stripper processes whatever nodes are present in the partial CST. Malformed code may retain some comment text if the parser cannot identify comment node boundaries.
- The canonicalizer similarly processes available nodes.
- **Fallback**: The worker returns the raw (stripped) text as `type1` and the partially canonicalized text as `type2`. No exception is raised.

### 10.3 Reserved Keywords as Identifiers

Python `class`, Java `void`, C `int`, and other reserved words are included in language-specific `PRESERVE_SETS` and are **never canonicalized**. This prevents the normalized output from becoming syntactically invalid.

### 10.4 Formatter Not Installed

If `black`, `google-java-format`, or `clang-format` is not available on `PATH` (and no JAR path is configured for Java):
- The formatter step is skipped.
- `type1` is the stripped text without pretty-printing.
- A `WARNING` is logged: `"Formatter unavailable — falling back to stripped text"`.
- `cipas_normalization_formatter_fallback_total` is incremented.
- Normalization still completes; `hash_type1` is computed over the fallback text.

### 10.5 Worker Process Crash (BrokenProcessPool)

If a worker process crashes mid-task:
- `NormalizationService` catches `BrokenExecutor` and raises `NormalizationError(stage=TYPE1_PIPELINE)`.
- The executor is **automatically recreated** via `_recreate_executor()` for subsequent requests.
- The failed granule receives an HTTP 500 response with `"stage": "type1_pipeline"`.

### 10.6 Unicode and Encoding

- All source bytes are decoded with `errors="replace"` (U+FFFD substitution) before processing.
- SHA-256 hashes are always computed over the UTF-8 re-encoding of the normalized text, ensuring cross-platform byte identity.

---

## 11. Testing

### 11.1 Determinism Integration Tests

**File**: `tests/integration/test_determinism.py`

Runs `run_normalization_worker()` synchronously (no `ProcessPoolExecutor`) to verify that identical inputs always produce identical outputs.

```bash
poetry run pytest tests/integration/test_determinism.py -v
```

Coverage:
- **105+ granules** across 3 languages (35+ Python, 35+ Java, 35+ C)
- Language constructs: functions, classes, loops, exceptions, generics, macros, structs
- Clone contracts: Type 1 comment invariance, Type 2 identifier invariance
- Edge cases: empty bodies, Unicode identifiers, broken syntax, Windows line endings, very long functions

### 11.2 HTTP API Integration Tests

**File**: `tests/integration/test_normalization_api.py`

Tests the FastAPI route layer using `httpx.AsyncClient` (ASGI transport, no live server).

```bash
# Fast tests (mocked NormalizationService, no subprocesses)
poetry run pytest tests/integration/test_normalization_api.py -v -m "not slow"

# Full stack tests (real NormalizationService + fakeredis, spawns worker processes)
poetry run pytest tests/integration/test_normalization_api.py -v -m "slow"

# All tests
poetry run pytest tests/integration/test_normalization_api.py -v
```

Coverage:
- `TestNormalizeSingleEndpoint` — HTTP contract, field presence, error shapes, 503/422/500 paths
- `TestNormalizeBatchEndpoint` — batch ordering, partial failure, size limits, mixed languages
- `TestNormalizeHealthEndpoint` — healthy/degraded states for executor and Redis
- `TestNormalizeRequestValidation` — Pydantic model validation (no HTTP needed)
- `TestNormalizeFullStack` — end-to-end with real worker processes and fakeredis

### 11.3 Performance Benchmarks

**File**: `tests/benchmarks/test_normalization_perf.py`

```bash
# Run with statistical benchmark reporting
poetry run pytest tests/benchmarks/test_normalization_perf.py -v --benchmark-sort=mean

# CI-friendly: timing assertions only
poetry run pytest tests/benchmarks/test_normalization_perf.py -v
```

Each benchmark uses ~500 LOC fixtures per language and asserts that full-pipeline latency is ≤ 100ms.

### 11.4 Running All Normalization Tests

```bash
cd apps/services/cipas-service

# All normalization tests (fast + slow + benchmarks)
poetry run pytest tests/ -v -k "normalization or determinism or perf"

# Skip slow (subprocess-spawning) tests for quick CI
poetry run pytest tests/ -v -k "normalization or determinism" -m "not slow"
```

---

## 12. Module Reference

```
src/cipas/normalization/
├── __init__.py              Public API surface: NormalizationService, NormalizationRequest,
│                            NormalizedResult, NormalizationError, NormalizationStage
├── models.py                Pydantic data models (NormalizationRequest, NormalizedResult,
│                            NormalizationError, FormatterKind, FormatterCheckResult)
├── service.py               NormalizationService — async orchestrator (ProcessPoolExecutor
│                            + Redis publisher + Prometheus metrics)
├── type1.py                 Type 1 pipeline entry points: run_type1(), run_type1_direct()
├── type2.py                 Type 2 pipeline entry points: run_type2(), run_type2_direct(),
│                            run_normalization_worker() (combined Type 1 + Type 2)
├── stripper.py              CSTStripper — tree-sitter comment/docstring stripping
├── pretty_printer.py        PrettyPrinter — black / google-java-format / clang-format
├── canonicalizer.py         Canonicalizer — identifier and literal canonicalization
│                            (IdentifierKind, CanonicalMapping, _Substitution)
├── metrics.py               Prometheus metrics registration and recording helpers
├── redis_publisher.py       RedisPublisher — async Redis SET/GET/MGET/pipeline
└── _worker_config.py        Per-process mutable globals for formatter configuration
                             (set by _normalization_worker_init in service.py)

src/cipas/api/v1/
├── deps/
│   └── normalization.py     FastAPI dependency: get_normalization_service()
│                            NormalizationServiceDep annotated alias
└── routes/
    └── normalization.py     Route handlers: normalize_granule(), normalize_batch(),
                             normalization_health()
                             Request/response schemas: NormalizeRequest,
                             NormalizeBatchRequest, NormalizedResultResponse,
                             NormalizeBatchResponse
```

### 12.1 Public Import Surface

External consumers (e.g., downstream scoring service) should import from the top-level package:

```python
from cipas.normalization import (
    NormalizationService,
    NormalizationRequest,
    NormalizedResult,
    NormalizationError,
    NormalizationStage,
)
```

Internal pipeline entry points for worker dispatch or direct in-process use:

```python
from cipas.normalization.type1 import run_type1_direct
from cipas.normalization.type2 import run_type2_direct, run_normalization_worker
from cipas.normalization.stripper import strip_comments
from cipas.normalization.canonicalizer import canonicalize
```

---

## Appendix A: Clone Detection Invariants

The following invariants are verified by the integration test suite and must hold for any correct implementation:

### A.1 Type 1 Clone Contract

> Given two granules `G1` and `G2` that differ **only** in comments, docstrings, and whitespace:
> `normalize(G1).hash_type1 == normalize(G2).hash_type1`

Verified by: `TestDeterminismCloneContracts.test_type1_comment_invariance_*`

### A.2 Type 2 Clone Contract

> Given two granules `G1` and `G2` that are Type 1 clones **or** differ only in user-defined identifier names or literal values:
> `normalize(G1).hash_type2 == normalize(G2).hash_type2`

Verified by: `TestDeterminismCloneContracts.test_type2_identifier_invariance_*`

### A.3 Non-Clone Discrimination

> Given two granules `G1` and `G2` that differ in **structure** (not just cosmetics):
> `normalize(G1).hash_type1 != normalize(G2).hash_type1`
> `normalize(G1).hash_type2 != normalize(G2).hash_type2`

Verified by: `TestDeterminismCloneContracts.test_type1_hash_changes_on_content_change_python`

### A.4 Determinism

> For any granule `G` processed at time `t1` and `t2`:
> `normalize(G, t1) == normalize(G, t2)` (byte-for-byte identical)

Verified by: All `TestDeterminism*` classes (runs each granule twice and asserts equality).

### A.5 Hash Integrity

> `hash_type1 == sha256(utf8(type1))` and `hash_type2 == sha256(utf8(type2))`

Enforced by `NormalizedResult.validate_hash_matches_text` (Pydantic `model_validator`) and verified in `_assert_deterministic()`.

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **Granule** | A sub-file code unit extracted by the ingestion pipeline (function, method, class, or top-level block). |
| **Type 1 clone** | Two granules whose `hash_type1` values are identical. |
| **Type 2 clone** | Two granules whose `hash_type2` values are identical. All Type 1 clones are also Type 2 clones. |
| **CST** | Concrete Syntax Tree — a full-fidelity parse tree produced by tree-sitter that includes all tokens (whitespace, comments, punctuation). |
| **Canonical token** | A synthetic identifier (`FUNC_N`, `PARAM_N`, `VAR_N`, `LIT_<sha1>`) that replaces a user-defined name or literal. |
| **DFS pre-order** | Depth-first traversal where a node is visited before its children, left-to-right. Determines canonical token assignment order. |
| **Worker process** | An OS process in the `ProcessPoolExecutor` that executes `run_normalization_worker()` synchronously. |
| **Pretty-printer** | An external formatter binary (`black`, `google-java-format`, `clang-format`) invoked as a subprocess. |
| **Fallback** | The behavior when a pretty-printer is unavailable or times out: use the stripped text verbatim. |