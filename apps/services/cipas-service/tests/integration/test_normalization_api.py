# gradeloop-core-v2/apps/services/cipas-service/tests/integration/test_normalization_api.py
"""
HTTP API integration tests for the CIPAS Syntactic Normalization Pipeline (E10/US02).

What is tested
──────────────
The FastAPI route layer for:
  POST   /api/v1/cipas/normalize          — single granule normalization
  POST   /api/v1/cipas/normalize/batch    — batch granule normalization
  GET    /api/v1/cipas/normalize/health   — NormalizationService health sub-probe

These tests exercise the full stack from HTTP request → route handler →
NormalizationService → normalization worker → response, but replace the
Redis publisher with fakeredis so no live Redis instance is required.

The ProcessPoolExecutor in NormalizationService is NOT used in these tests:
the NormalizationService is replaced with a lightweight AsyncMock/stub so
tests run in-process without spawning subprocesses.  The correctness of the
normalization pipeline itself is verified in test_determinism.py.  This test
suite focuses exclusively on:

  1. HTTP contract (status codes, response shape, field names)
  2. Request validation (unsupported language, empty granule_id, oversized batch)
  3. Error path shaping (NormalizationError → HTTP 500 with RFC-7807 body)
  4. Batch semantics (ordering, partial failure, summary counts)
  5. Health endpoint (200 vs 503 based on service state)
  6. End-to-end pipeline calls via a real NormalizationService backed by
     fakeredis (the "full-stack" class at the bottom of this file).

Test structure
──────────────
  TestNormalizeSingleEndpoint     — POST /normalize contract tests (mocked service)
  TestNormalizeBatchEndpoint      — POST /normalize/batch contract tests (mocked service)
  TestNormalizeHealthEndpoint     — GET /normalize/health contract tests (mocked service)
  TestNormalizeRequestValidation  — Pydantic request model validation
  TestNormalizeFullStack          — End-to-end tests with a real NormalizationService
                                    backed by fakeredis (no live Redis/subprocess needed
                                    because fakeredis replaces the Redis client and the
                                    worker function is called synchronously)

Design notes
────────────
  - All tests use httpx.AsyncClient (ASGI transport) — no live server needed.
  - The NormalizationService dependency is overridden via
    app.dependency_overrides so tests never spawn worker processes.
  - The full-stack tests create a NormalizationService with a real executor
    but patch the RedisPublisher with a fakeredis-backed one.
  - pytest-asyncio is configured in auto mode (pyproject.toml asyncio_mode=auto).
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
import hashlib
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest

from cipas.api.v1.deps.normalization import get_normalization_service
from cipas.main import create_app
from cipas.normalization.models import (
    NormalizationError,
    NormalizationRequest,
    NormalizationStage,
    NormalizedResult,
)
from cipas.normalization.service import NormalizationService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PYTHON_SNIPPET = """\
def add(a, b):
    # add two numbers
    return a + b
"""

_JAVA_SNIPPET = """\
public class Calculator {
    // add method
    public int add(int a, int b) {
        return a + b;
    }
}
"""

_C_SNIPPET = """\
/* add two ints */
int add(int a, int b) {
    return a + b;
}
"""

_UNSUPPORTED_LANG = "cobol"


def _make_hash(text: str) -> str:
    """Compute SHA-256 of UTF-8 text — mirrors NormalizedResult.make_hash()."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _fake_normalized_result(
    granule_id: str = "test-granule-01",
    language: str = "python",
    type1: str = "def add(a, b):\n    return a + b\n",
    type2: str = "def FUNC_1(PARAM_1, PARAM_2):\n    return PARAM_1 + PARAM_2\n",
) -> NormalizedResult:
    """Build a NormalizedResult with consistent hashes for use in mock returns."""
    return NormalizedResult(
        granule_id=granule_id,
        language=language,
        type1=type1,
        type2=type2,
        hash_type1=_make_hash(type1),
        hash_type2=_make_hash(type2),
        normalized_at="2024-06-01T12:00:00+00:00",
    )


# ---------------------------------------------------------------------------
# App fixture — creates the FastAPI app WITHOUT starting the lifespan.
# The NormalizationService dependency is overridden per test class.
# ---------------------------------------------------------------------------


@pytest.fixture()
def app() -> FastAPI:
    """
    Return a FastAPI app instance with default settings.

    The lifespan is NOT invoked (no DB pool, no pipeline, no executor).
    Individual test classes install their own dependency overrides.
    """
    from cipas.core.config import Settings

    settings = Settings(
        DATABASE_URL="postgresql://cipas:cipas_secret@localhost:5435/cipas_db",
        REDIS_URL="redis://localhost:6379/0",
        ENV="development",
    )
    _app = create_app(settings=settings)
    return _app


@pytest.fixture()
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client pointed at the in-process ASGI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Mock service builder
# ---------------------------------------------------------------------------


def _mock_service(
    *,
    normalize_return: NormalizedResult | Exception | None = None,
    normalize_batch_return: list[NormalizedResult | None] | Exception | None = None,
    health_return: dict[str, Any] | None = None,
) -> MagicMock:
    """
    Build a MagicMock that satisfies the NormalizationService interface.

    Args:
        normalize_return:       Return value (or exception to raise) for normalize().
        normalize_batch_return: Return value (or exception to raise) for normalize_batch().
        health_return:          Return value for health_check().

    Returns:
        MagicMock with async methods patched as AsyncMock.
    """
    svc = MagicMock(spec=NormalizationService)
    svc.is_started = True

    # normalize()
    if isinstance(normalize_return, Exception):
        svc.normalize = AsyncMock(side_effect=normalize_return)
    elif normalize_return is None:
        svc.normalize = AsyncMock(return_value=_fake_normalized_result())
    else:
        svc.normalize = AsyncMock(return_value=normalize_return)

    # normalize_batch()
    if isinstance(normalize_batch_return, Exception):
        svc.normalize_batch = AsyncMock(side_effect=normalize_batch_return)
    elif normalize_batch_return is None:
        # Default: one successful result
        svc.normalize_batch = AsyncMock(return_value=[_fake_normalized_result()])
    else:
        svc.normalize_batch = AsyncMock(return_value=normalize_batch_return)

    # health_check()
    if health_return is None:
        health_return = {
            "executor_ok": True,
            "redis_ok": True,
            "worker_count": 2,
            "pending_tasks": 0,
        }
    svc.health_check = AsyncMock(return_value=health_return)

    return svc


# ---------------------------------------------------------------------------
# TestNormalizeSingleEndpoint
# ---------------------------------------------------------------------------


class TestNormalizeSingleEndpoint:
    """Tests for POST /api/v1/cipas/normalize."""

    @pytest.fixture(autouse=True)
    def install_mock_service(self, app: FastAPI) -> Generator[None, None, None]:
        """Install a mock NormalizationService for all tests in this class."""
        self._mock_svc = _mock_service()
        app.dependency_overrides[get_normalization_service] = lambda: self._mock_svc
        yield
        app.dependency_overrides.clear()

    async def test_successful_normalization_returns_200(
        self, client: AsyncClient
    ) -> None:
        """A valid request returns HTTP 200 with all required fields."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "granule-01",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 200, resp.text

    async def test_response_contains_all_required_fields(
        self, client: AsyncClient
    ) -> None:
        """Response JSON contains granule_id, language, type1, type2, hashes, timestamp."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "granule-02",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        body = resp.json()
        for field in (
            "granule_id",
            "language",
            "type1",
            "type2",
            "hash_type1",
            "hash_type2",
            "normalized_at",
            "processing_ms",
        ):
            assert field in body, f"Missing field: {field!r}"

    async def test_response_echoes_granule_id_and_language(
        self, client: AsyncClient
    ) -> None:
        """granule_id and language are echoed back from the request."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "my-unique-granule",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        body = resp.json()
        assert body["granule_id"] == "my-unique-granule"
        assert body["language"] == "python"

    async def test_hash_fields_are_64_char_hex(self, client: AsyncClient) -> None:
        """hash_type1 and hash_type2 are exactly 64 lowercase hex characters."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "hash-check",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        body = resp.json()
        for field in ("hash_type1", "hash_type2"):
            value = body[field]
            assert len(value) == 64, f"{field} length is {len(value)}, expected 64"
            assert all(c in "0123456789abcdef" for c in value), (
                f"{field} contains non-hex characters: {value!r}"
            )

    async def test_processing_ms_is_non_negative(self, client: AsyncClient) -> None:
        """processing_ms is a non-negative float."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "timing-check",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        body = resp.json()
        assert isinstance(body["processing_ms"], (int, float))
        assert body["processing_ms"] >= 0.0

    async def test_java_language_accepted(self, client: AsyncClient) -> None:
        """language='java' is accepted and the service is called."""
        self._mock_svc.normalize = AsyncMock(
            return_value=_fake_normalized_result(language="java")
        )
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "java-granule",
                "language": "java",
                "source_text": _JAVA_SNIPPET,
            },
        )
        assert resp.status_code == 200, resp.text

    async def test_c_language_accepted(self, client: AsyncClient) -> None:
        """language='c' is accepted and the service is called."""
        self._mock_svc.normalize = AsyncMock(
            return_value=_fake_normalized_result(language="c")
        )
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "c-granule",
                "language": "c",
                "source_text": _C_SNIPPET,
            },
        )
        assert resp.status_code == 200, resp.text

    async def test_language_is_case_insensitive(self, client: AsyncClient) -> None:
        """Language 'Python' (mixed case) is normalised to 'python' and accepted."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "case-insensitive",
                "language": "Python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 200, resp.text

    async def test_unsupported_language_returns_422(self, client: AsyncClient) -> None:
        """An unsupported language returns HTTP 422 without calling the service."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "bad-lang",
                "language": _UNSUPPORTED_LANG,
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 422, resp.text
        self._mock_svc.normalize.assert_not_called()

    async def test_empty_granule_id_returns_422(self, client: AsyncClient) -> None:
        """A blank granule_id returns HTTP 422."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "   ",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 422, resp.text

    async def test_empty_source_text_returns_422(self, client: AsyncClient) -> None:
        """An empty source_text returns HTTP 422 (min_length=1)."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "empty-source",
                "language": "python",
                "source_text": "",
            },
        )
        assert resp.status_code == 422, resp.text

    async def test_missing_language_returns_422(self, client: AsyncClient) -> None:
        """A missing language field returns HTTP 422."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "no-lang",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 422, resp.text

    async def test_normalization_error_returns_500(self, client: AsyncClient) -> None:
        """When the service raises NormalizationError, the endpoint returns HTTP 500."""
        self._mock_svc.normalize = AsyncMock(
            side_effect=NormalizationError(
                granule_id="crash-granule",
                language="python",
                stage=NormalizationStage.TYPE1_PIPELINE,
                reason="worker timed out",
            )
        )
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "crash-granule",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 500, resp.text

    async def test_normalization_error_body_contains_stage(
        self, client: AsyncClient
    ) -> None:
        """The HTTP 500 body contains the pipeline stage that failed."""
        self._mock_svc.normalize = AsyncMock(
            side_effect=NormalizationError(
                granule_id="stage-check",
                language="python",
                stage=NormalizationStage.PRETTY_PRINT,
                reason="black not found",
            )
        )
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "stage-check",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        body = resp.json()
        assert body.get("stage") == NormalizationStage.PRETTY_PRINT.value

    async def test_service_unavailable_returns_503(
        self, app: FastAPI, client: AsyncClient
    ) -> None:
        """When the service is not on app.state, the dependency returns HTTP 503."""
        app.dependency_overrides.clear()
        # Ensure normalization_service is absent from app.state.
        if hasattr(app.state, "normalization_service"):
            del app.state.normalization_service
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "no-service",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        )
        assert resp.status_code == 503, resp.text

    async def test_normalize_called_with_correct_request(
        self, client: AsyncClient
    ) -> None:
        """The service's normalize() is called with the correct granule_id and language."""
        resp = await client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "assert-call-args",
                "language": "java",
                "source_text": _JAVA_SNIPPET,
            },
        )
        assert resp.status_code == 200, resp.text
        self._mock_svc.normalize.assert_called_once()
        call_arg: NormalizationRequest = self._mock_svc.normalize.call_args[0][0]
        assert call_arg.granule_id == "assert-call-args"
        assert call_arg.language == "java"
        # source_bytes must be the UTF-8 encoding of source_text
        assert call_arg.source_bytes == _JAVA_SNIPPET.encode("utf-8")


# ---------------------------------------------------------------------------
# TestNormalizeBatchEndpoint
# ---------------------------------------------------------------------------


class TestNormalizeBatchEndpoint:
    """Tests for POST /api/v1/cipas/normalize/batch."""

    @pytest.fixture(autouse=True)
    def install_mock_service(self, app: FastAPI) -> Generator[None, None, None]:
        self._mock_svc = _mock_service()
        app.dependency_overrides[get_normalization_service] = lambda: self._mock_svc
        yield
        app.dependency_overrides.clear()

    def _batch_body(
        self, granules: list[dict[str, str]] | None = None
    ) -> dict[str, Any]:
        if granules is None:
            granules = [
                {
                    "granule_id": "g1",
                    "language": "python",
                    "source_text": _PYTHON_SNIPPET,
                }
            ]
        return {"granules": granules}

    async def test_single_item_batch_returns_200(self, client: AsyncClient) -> None:
        """A batch with one granule returns HTTP 200."""
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json=self._batch_body(),
        )
        assert resp.status_code == 200, resp.text

    async def test_batch_response_shape(self, client: AsyncClient) -> None:
        """Response contains total, succeeded, failed, processing_ms, results."""
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json=self._batch_body(),
        )
        body = resp.json()
        for field in ("total", "succeeded", "failed", "processing_ms", "results"):
            assert field in body, f"Missing field: {field!r}"

    async def test_batch_total_matches_input(self, client: AsyncClient) -> None:
        """total in the response equals the number of granules in the request."""
        granules = [
            {
                "granule_id": f"g{i}",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            }
            for i in range(3)
        ]
        results = [_fake_normalized_result(granule_id=f"g{i}") for i in range(3)]
        self._mock_svc.normalize_batch = AsyncMock(return_value=results)

        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        body = resp.json()
        assert body["total"] == 3
        assert body["succeeded"] == 3
        assert body["failed"] == 0
        assert len(body["results"]) == 3

    async def test_batch_results_preserve_order(self, client: AsyncClient) -> None:
        """Results are returned in the same order as the input granules."""
        ids = ["z-third", "a-first", "m-second"]
        granules = [
            {"granule_id": gid, "language": "python", "source_text": _PYTHON_SNIPPET}
            for gid in ids
        ]
        results = [_fake_normalized_result(granule_id=gid) for gid in ids]
        self._mock_svc.normalize_batch = AsyncMock(return_value=results)

        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        body = resp.json()
        returned_ids = [r["granule_id"] for r in body["results"] if r is not None]
        assert returned_ids == ids

    async def test_partial_failure_null_slot(self, client: AsyncClient) -> None:
        """Failed granules appear as null in the results list."""
        self._mock_svc.normalize_batch = AsyncMock(
            return_value=[
                _fake_normalized_result(granule_id="ok-granule"),
                None,  # failed slot
            ]
        )
        granules = [
            {
                "granule_id": "ok-granule",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
            {
                "granule_id": "fail-granule",
                "language": "python",
                "source_text": _PYTHON_SNIPPET,
            },
        ]
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        body = resp.json()
        assert body["total"] == 2
        assert body["succeeded"] == 1
        assert body["failed"] == 1
        assert body["results"][0] is not None
        assert body["results"][1] is None

    async def test_empty_granules_list_returns_422(self, client: AsyncClient) -> None:
        """An empty granules list returns HTTP 422 (min_length=1)."""
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": []},
        )
        assert resp.status_code == 422, resp.text
        self._mock_svc.normalize_batch.assert_not_called()

    async def test_oversized_batch_returns_422(self, client: AsyncClient) -> None:
        """A batch exceeding NORMALIZATION_BATCH_SIZE returns HTTP 422."""
        # Build a batch of 513 granules (well above the default 64 max).
        granules = [
            {"granule_id": f"g{i}", "language": "python", "source_text": "x = 1"}
            for i in range(513)
        ]
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        assert resp.status_code == 422, resp.text
        self._mock_svc.normalize_batch.assert_not_called()

    async def test_mixed_language_batch(self, client: AsyncClient) -> None:
        """A batch containing Python, Java, and C granules is accepted."""
        granules = [
            {"granule_id": "py", "language": "python", "source_text": _PYTHON_SNIPPET},
            {"granule_id": "java", "language": "java", "source_text": _JAVA_SNIPPET},
            {"granule_id": "c", "language": "c", "source_text": _C_SNIPPET},
        ]
        results = [
            _fake_normalized_result(granule_id="py", language="python"),
            _fake_normalized_result(granule_id="java", language="java"),
            _fake_normalized_result(granule_id="c", language="c"),
        ]
        self._mock_svc.normalize_batch = AsyncMock(return_value=results)

        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 3
        assert body["succeeded"] == 3

    async def test_batch_normalization_error_returns_500(
        self, client: AsyncClient
    ) -> None:
        """When all granules fail, NormalizationError produces HTTP 500."""
        self._mock_svc.normalize_batch = AsyncMock(
            side_effect=NormalizationError(
                granule_id="g1",
                language="python",
                stage=NormalizationStage.TYPE2_PIPELINE,
                reason="all workers crashed",
            )
        )
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json=self._batch_body(),
        )
        assert resp.status_code == 500, resp.text

    async def test_invalid_language_in_batch_returns_422(
        self, client: AsyncClient
    ) -> None:
        """A batch with an invalid language in one item returns HTTP 422."""
        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={
                "granules": [
                    {
                        "granule_id": "bad",
                        "language": "javascript",
                        "source_text": "console.log('hi');",
                    }
                ]
            },
        )
        assert resp.status_code == 422, resp.text

    async def test_normalize_batch_called_with_all_requests(
        self, client: AsyncClient
    ) -> None:
        """normalize_batch() is called with one NormalizationRequest per input granule."""
        granules = [
            {"granule_id": f"g{i}", "language": "python", "source_text": f"x = {i}"}
            for i in range(5)
        ]
        results = [_fake_normalized_result(granule_id=f"g{i}") for i in range(5)]
        self._mock_svc.normalize_batch = AsyncMock(return_value=results)

        resp = await client.post(
            "/api/v1/cipas/normalize/batch",
            json={"granules": granules},
        )
        assert resp.status_code == 200, resp.text
        self._mock_svc.normalize_batch.assert_called_once()
        call_requests: list[NormalizationRequest] = (
            self._mock_svc.normalize_batch.call_args[0][0]
        )
        assert len(call_requests) == 5
        for i, req in enumerate(call_requests):
            assert req.granule_id == f"g{i}"
            assert req.language == "python"


# ---------------------------------------------------------------------------
# TestNormalizeHealthEndpoint
# ---------------------------------------------------------------------------


class TestNormalizeHealthEndpoint:
    """Tests for GET /api/v1/cipas/normalize/health."""

    @pytest.fixture(autouse=True)
    def install_mock_service(self, app: FastAPI) -> Generator[None, None, None]:
        self._mock_svc = _mock_service()
        app.dependency_overrides[get_normalization_service] = lambda: self._mock_svc
        yield
        app.dependency_overrides.clear()

    async def test_healthy_service_returns_200(self, client: AsyncClient) -> None:
        """When executor and Redis are both healthy, returns HTTP 200."""
        self._mock_svc.health_check = AsyncMock(
            return_value={
                "executor_ok": True,
                "redis_ok": True,
                "worker_count": 4,
                "pending_tasks": 0,
            }
        )
        resp = await client.get("/api/v1/cipas/normalize/health")
        assert resp.status_code == 200, resp.text

    async def test_healthy_response_body(self, client: AsyncClient) -> None:
        """Healthy response body contains expected fields with correct values."""
        self._mock_svc.health_check = AsyncMock(
            return_value={
                "executor_ok": True,
                "redis_ok": True,
                "worker_count": 2,
                "pending_tasks": 3,
            }
        )
        resp = await client.get("/api/v1/cipas/normalize/health")
        body = resp.json()
        assert body["status"] == "ok"
        assert body["executor_ok"] is True
        assert body["redis_ok"] is True
        assert body["worker_count"] == 2
        assert body["pending_tasks"] == 3

    async def test_degraded_executor_returns_503(self, client: AsyncClient) -> None:
        """When the executor is broken, returns HTTP 503."""
        self._mock_svc.health_check = AsyncMock(
            return_value={
                "executor_ok": False,
                "redis_ok": True,
                "worker_count": 0,
                "pending_tasks": 0,
            }
        )
        resp = await client.get("/api/v1/cipas/normalize/health")
        assert resp.status_code == 503, resp.text
        body = resp.json()
        assert body["status"] == "degraded"

    async def test_degraded_redis_returns_503(self, client: AsyncClient) -> None:
        """When Redis is unreachable, returns HTTP 503."""
        self._mock_svc.health_check = AsyncMock(
            return_value={
                "executor_ok": True,
                "redis_ok": False,
                "worker_count": 4,
                "pending_tasks": 0,
            }
        )
        resp = await client.get("/api/v1/cipas/normalize/health")
        assert resp.status_code == 503, resp.text

    async def test_both_degraded_returns_503(self, client: AsyncClient) -> None:
        """When both executor and Redis are down, returns HTTP 503."""
        self._mock_svc.health_check = AsyncMock(
            return_value={
                "executor_ok": False,
                "redis_ok": False,
                "worker_count": 0,
                "pending_tasks": 0,
            }
        )
        resp = await client.get("/api/v1/cipas/normalize/health")
        assert resp.status_code == 503, resp.text

    async def test_service_unavailable_returns_503(
        self, app: FastAPI, client: AsyncClient
    ) -> None:
        """When the service is absent from app.state, returns HTTP 503."""
        app.dependency_overrides.clear()
        if hasattr(app.state, "normalization_service"):
            del app.state.normalization_service
        resp = await client.get("/api/v1/cipas/normalize/health")
        assert resp.status_code == 503, resp.text


# ---------------------------------------------------------------------------
# TestNormalizeRequestValidation — pure Pydantic model tests
# ---------------------------------------------------------------------------


class TestNormalizeRequestValidation:
    """Tests for the NormalizeRequest Pydantic model (no HTTP round-trip needed)."""

    def test_valid_python_request(self) -> None:
        """A well-formed Python NormalizeRequest is constructed without errors."""
        from cipas.api.v1.routes.normalization import NormalizeRequest

        req = NormalizeRequest(
            granule_id="valid-001",
            language="python",
            source_text="def f(): pass",
        )
        assert req.language == "python"

    def test_language_normalised_to_lowercase(self) -> None:
        """Language strings are lowercased by the validator."""
        from cipas.api.v1.routes.normalization import NormalizeRequest

        req = NormalizeRequest(
            granule_id="case-test",
            language="JAVA",
            source_text="class Foo {}",
        )
        assert req.language == "java"

    def test_unsupported_language_raises(self) -> None:
        """An unsupported language raises pydantic ValidationError."""
        from pydantic import ValidationError

        from cipas.api.v1.routes.normalization import NormalizeRequest

        with pytest.raises(ValidationError, match="Unsupported language"):
            NormalizeRequest(
                granule_id="bad",
                language="rust",
                source_text="fn main() {}",
            )

    def test_blank_granule_id_raises(self) -> None:
        """A whitespace-only granule_id raises pydantic ValidationError."""
        from pydantic import ValidationError

        from cipas.api.v1.routes.normalization import NormalizeRequest

        with pytest.raises(ValidationError):
            NormalizeRequest(
                granule_id="   ",
                language="python",
                source_text="x = 1",
            )

    def test_to_normalization_request_derives_bytes(self) -> None:
        """to_normalization_request() sets source_bytes = source_text.encode('utf-8')."""
        from cipas.api.v1.routes.normalization import NormalizeRequest

        source = "def hello(): pass"
        req = NormalizeRequest(
            granule_id="bytes-check",
            language="python",
            source_text=source,
        )
        norm_req = req.to_normalization_request()
        assert norm_req.source_bytes == source.encode("utf-8")
        assert norm_req.granule_id == "bytes-check"
        assert norm_req.language == "python"

    def test_batch_request_with_valid_granules(self) -> None:
        """A NormalizeBatchRequest with three valid items is accepted."""
        from cipas.api.v1.routes.normalization import (
            NormalizeBatchRequest,
            NormalizeRequest,
        )

        batch = NormalizeBatchRequest(
            granules=[
                NormalizeRequest(
                    granule_id=f"g{i}", language="python", source_text=f"x = {i}"
                )
                for i in range(3)
            ]
        )
        assert len(batch.granules) == 3

    def test_empty_batch_raises(self) -> None:
        """An empty granules list raises pydantic ValidationError."""
        from pydantic import ValidationError

        from cipas.api.v1.routes.normalization import NormalizeBatchRequest

        with pytest.raises(ValidationError):
            NormalizeBatchRequest(granules=[])


# ---------------------------------------------------------------------------
# TestNormalizeFullStack — real NormalizationService with fakeredis
# ---------------------------------------------------------------------------


class TestNormalizeFullStack:
    """
    End-to-end tests that invoke the real NormalizationService but replace the
    Redis client with a fakeredis in-memory instance.

    The NormalizationService's ProcessPoolExecutor IS used here, so the tree-sitter
    parsers and formatters are exercised.  These tests are slower than the mocked
    tests above but validate the full integration from HTTP → service → worker.

    Because these tests spawn subprocesses, they are marked with the 'slow' marker
    and can be excluded from fast CI runs with: pytest -m "not slow".
    """

    @pytest.fixture()
    async def real_svc(self) -> AsyncGenerator[NormalizationService, None]:
        """
        Start a real NormalizationService backed by fakeredis.

        Patches RedisPublisher.from_url to return a publisher that uses
        fakeredis instead of a real Redis connection, then starts and
        yields the service.
        """
        import fakeredis.aioredis as aioredis_fake  # type: ignore[import]

        from cipas.core.config import Settings
        from cipas.normalization.redis_publisher import RedisPublisher

        settings = Settings(
            DATABASE_URL="postgresql://cipas:cipas_secret@localhost:5435/cipas_db",
            REDIS_URL="redis://localhost:6379/0",
            ENV="development",
            NORMALIZATION_WORKERS=1,
        )

        fake_redis_client = aioredis_fake.FakeRedis(decode_responses=False)

        # Build a real publisher but point it at the fake Redis client.
        publisher = RedisPublisher(
            client=fake_redis_client,
            ttl_seconds=settings.NORMALIZATION_TTL_SECONDS,
        )

        svc = NormalizationService(settings=settings)

        # Patch from_url so start() doesn't try to connect to a real Redis.
        with patch.object(
            RedisPublisher,
            "from_url",
            return_value=publisher,
        ):
            await svc.start()

        yield svc

        await svc.stop()

    @pytest.fixture()
    def app_with_real_svc(
        self, app: FastAPI, real_svc: NormalizationService
    ) -> Generator[FastAPI, None, None]:
        """Install the real (fakeredis-backed) service into the app."""
        app.dependency_overrides[get_normalization_service] = lambda: real_svc
        yield app
        app.dependency_overrides.clear()

    @pytest.fixture()
    async def real_client(
        self, app_with_real_svc: FastAPI
    ) -> AsyncGenerator[AsyncClient, None]:
        async with AsyncClient(
            transport=ASGITransport(app=app_with_real_svc),
            base_url="http://testserver",
        ) as ac:
            yield ac

    @pytest.mark.slow
    async def test_python_type1_strips_comments(self, real_client: AsyncClient) -> None:
        """
        Given two Python functions differing only in comments/whitespace,
        their type1 hashes must be identical (Type-1 clone contract).
        """
        source_a = "def add(a, b):\n    # adds two numbers\n    return a + b\n"
        source_b = "def add(a, b):\n\n\n    return a + b\n"

        resp_a = await real_client.post(
            "/api/v1/cipas/normalize",
            json={"granule_id": "py-a", "language": "python", "source_text": source_a},
        )
        resp_b = await real_client.post(
            "/api/v1/cipas/normalize",
            json={"granule_id": "py-b", "language": "python", "source_text": source_b},
        )
        assert resp_a.status_code == 200, resp_a.text
        assert resp_b.status_code == 200, resp_b.text

        # After Type-1 normalization, comment-only differences disappear.
        assert resp_a.json()["hash_type1"] == resp_b.json()["hash_type1"], (
            "Type-1 hashes should be equal when sources differ only in comments.\n"
            f"  type1_a: {resp_a.json()['type1']!r}\n"
            f"  type1_b: {resp_b.json()['type1']!r}"
        )

    @pytest.mark.slow
    async def test_python_type2_identifier_invariance(
        self, real_client: AsyncClient
    ) -> None:
        """
        Given two Python functions with renamed variables (count → idx),
        their type2 hashes must be identical (Type-2 clone contract).
        """
        source_a = "def loop():\n    for count in range(10):\n        print(count)\n"
        source_b = "def loop():\n    for idx in range(10):\n        print(idx)\n"

        resp_a = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "py-var-a",
                "language": "python",
                "source_text": source_a,
            },
        )
        resp_b = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "py-var-b",
                "language": "python",
                "source_text": source_b,
            },
        )
        assert resp_a.status_code == 200, resp_a.text
        assert resp_b.status_code == 200, resp_b.text

        # Type-1 hashes differ because identifier names differ.
        assert resp_a.json()["hash_type1"] != resp_b.json()["hash_type1"], (
            "Type-1 hashes should differ when variable names differ"
        )
        # Type-2 hashes must be equal because both reduce to the same canonical form.
        assert resp_a.json()["hash_type2"] == resp_b.json()["hash_type2"], (
            "Type-2 hashes should be equal when sources differ only in variable names.\n"
            f"  type2_a: {resp_a.json()['type2']!r}\n"
            f"  type2_b: {resp_b.json()['type2']!r}"
        )

    @pytest.mark.slow
    async def test_java_type2_renamed_variable(self, real_client: AsyncClient) -> None:
        """
        Given two Java methods with renamed variables (count → idx),
        their type2 hashes must be identical.
        """
        source_a = (
            "void loop() {\n"
            "    for (int count = 0; count < 10; count++) {\n"
            "        System.out.println(count);\n"
            "    }\n"
            "}\n"
        )
        source_b = (
            "void loop() {\n"
            "    for (int idx = 0; idx < 10; idx++) {\n"
            "        System.out.println(idx);\n"
            "    }\n"
            "}\n"
        )
        resp_a = await real_client.post(
            "/api/v1/cipas/normalize",
            json={"granule_id": "java-a", "language": "java", "source_text": source_a},
        )
        resp_b = await real_client.post(
            "/api/v1/cipas/normalize",
            json={"granule_id": "java-b", "language": "java", "source_text": source_b},
        )
        assert resp_a.status_code == 200, resp_a.text
        assert resp_b.status_code == 200, resp_b.text
        assert resp_a.json()["hash_type2"] == resp_b.json()["hash_type2"], (
            "Java renamed-variable clones must have equal hash_type2.\n"
            f"  type2_a: {resp_a.json()['type2']!r}\n"
            f"  type2_b: {resp_b.json()['type2']!r}"
        )

    @pytest.mark.slow
    async def test_c_type1_strips_comments(self, real_client: AsyncClient) -> None:
        """
        A C function with mixed block/line comments normalizes identically
        to the same function with no comments (Type-1 contract).
        """
        source_with = "/* add */ int add(int a, int b) { /* body */ return a + b; }\n"
        source_without = "int add(int a, int b) { return a + b; }\n"

        resp_with = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "c-with-comments",
                "language": "c",
                "source_text": source_with,
            },
        )
        resp_without = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "c-without-comments",
                "language": "c",
                "source_text": source_without,
            },
        )
        assert resp_with.status_code == 200, resp_with.text
        assert resp_without.status_code == 200, resp_without.text
        assert resp_with.json()["hash_type1"] == resp_without.json()["hash_type1"], (
            "C functions differing only in comments must have equal hash_type1"
        )

    @pytest.mark.slow
    async def test_determinism_same_input_same_output(
        self, real_client: AsyncClient
    ) -> None:
        """
        Running normalization twice on the same source always produces identical output.
        Validates the determinism contract over HTTP.
        """
        source = "def compute(x, y):\n    result = x * 2 + y\n    return result\n"
        payload = {
            "granule_id": "det-test",
            "language": "python",
            "source_text": source,
        }

        resp1 = await real_client.post("/api/v1/cipas/normalize", json=payload)
        resp2 = await real_client.post("/api/v1/cipas/normalize", json=payload)

        assert resp1.status_code == 200, resp1.text
        assert resp2.status_code == 200, resp2.text

        b1, b2 = resp1.json(), resp2.json()
        assert b1["hash_type1"] == b2["hash_type1"], "hash_type1 must be deterministic"
        assert b1["hash_type2"] == b2["hash_type2"], "hash_type2 must be deterministic"
        assert b1["type1"] == b2["type1"], "type1 text must be deterministic"
        assert b1["type2"] == b2["type2"], "type2 text must be deterministic"

    @pytest.mark.slow
    async def test_batch_100_mixed_granules(self, real_client: AsyncClient) -> None:
        """
        Normalise 60 granules across 3 languages in a single batch call.

        Validates that the batch endpoint works end-to-end with a real service
        and produces 60 non-None results (no failures).
        """
        snippets = {
            "python": [f"def func_{i}(x):\n    return x + {i}\n" for i in range(20)],
            "java": [f"int func{i}(int x) {{ return x + {i}; }}\n" for i in range(20)],
            "c": [f"int func{i}(int x) {{ return x + {i}; }}\n" for i in range(20)],
        }

        granules: list[dict[str, str]] = []
        for lang, sources in snippets.items():
            for idx, src in enumerate(sources):
                granules.append(
                    {
                        "granule_id": f"batch-{lang}-{idx}",
                        "language": lang,
                        "source_text": src,
                    }
                )

        assert len(granules) == 60

        # Send in two sub-batches of 30 to stay within the default batch limit.
        all_results: list[dict[str, Any]] = []
        for chunk_start in range(0, 60, 30):
            chunk = granules[chunk_start : chunk_start + 30]
            resp = await real_client.post(
                "/api/v1/cipas/normalize/batch",
                json={"granules": chunk},
            )
            assert resp.status_code == 200, resp.text
            body = resp.json()
            assert body["failed"] == 0, (
                f"Batch chunk {chunk_start}-{chunk_start + 30} had failures: "
                f"{body['failed']} of {body['total']}"
            )
            all_results.extend(r for r in body["results"] if r is not None)

        assert len(all_results) == 60, (
            f"Expected 60 successful results, got {len(all_results)}"
        )
        # All results must have valid 64-char hex hashes.
        for result in all_results:
            assert len(result["hash_type1"]) == 64
            assert len(result["hash_type2"]) == 64

    @pytest.mark.slow
    async def test_type2_canonical_tokens_present_in_output(
        self, real_client: AsyncClient
    ) -> None:
        """
        The type2 output contains canonical token prefixes (VAR_, PARAM_, FUNC_, LIT_).
        Validates that the canonicalizer is actually running.
        """
        source = (
            "def compute(value, multiplier):\n"
            "    result = value * multiplier + 42\n"
            "    return result\n"
        )
        resp = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "token-check",
                "language": "python",
                "source_text": source,
            },
        )
        assert resp.status_code == 200, resp.text
        type2 = resp.json()["type2"]

        # At least one canonical prefix must appear in the output.
        has_canonical = any(
            prefix in type2 for prefix in ("FUNC_", "PARAM_", "VAR_", "LIT_")
        )
        assert has_canonical, (
            f"Expected at least one canonical token in type2 output, got:\n{type2!r}"
        )

    @pytest.mark.slow
    async def test_hash_type1_matches_sha256_of_type1(
        self, real_client: AsyncClient
    ) -> None:
        """
        hash_type1 == SHA-256(type1) — the hash integrity contract holds over HTTP.
        """
        resp = await real_client.post(
            "/api/v1/cipas/normalize",
            json={
                "granule_id": "hash-integrity",
                "language": "python",
                "source_text": "def f(x):\n    return x\n",
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        expected_h1 = hashlib.sha256(body["type1"].encode("utf-8")).hexdigest()
        expected_h2 = hashlib.sha256(body["type2"].encode("utf-8")).hexdigest()
        assert body["hash_type1"] == expected_h1, "hash_type1 mismatch"
        assert body["hash_type2"] == expected_h2, "hash_type2 mismatch"
