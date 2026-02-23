(
    gradeloop
    - core
    - v2 / apps / services / cipas
    - service / src / cipas / services / analysis / analysis.py
)
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from pydantic import BaseModel, Field

# Local imports (project-local async storage abstraction and deps provide an AI model stub)
try:
    from cipas.services.storage.storage import AsyncMinioStorage  # type: ignore
except Exception:  # pragma: no cover - defensive import for isolated editing
    AsyncMinioStorage = Any  # type: ignore

# The AI model dependency is expected to provide an async `analyze(code: str) -> dict` API.
AIModel = Any


class Finding(BaseModel):
    """
    A single finding from code analysis.
    """

    id: str
    category: str
    message: str
    severity: str = Field(
        "info", description="one of: info, low, medium, high, critical"
    )
    location: Optional[Dict[str, int]] = None  # e.g. {"line": 12, "col": 4}
    evidence: Optional[str] = None


class AnalysisResult(BaseModel):
    """
    Structured result for a single analysis run.
    """

    id: str
    timestamp: datetime
    summary: str
    length: int
    findings: List[Finding]
    metadata: Dict[str, Any] = Field(default_factory=dict)


@dataclass
class AnalysisService:
    """
    Async-first analysis service that orchestrates simple static heuristics and an
    optional AI-model analysis (stubbed). This is intentionally a lightweight,
    framework-agnostic service intended to be injected via FastAPI dependencies.

    Responsibilities:
    - Provide an `analyze_code` method that returns structured findings.
    - Provide a convenience `analyze_s3_object` to fetch file contents from storage and analyze it.
    - Keep CPU-bound heuristics off the event loop when potentially heavy via thread executor.
    """

    ai_model: Optional[AIModel] = None
    storage: Optional[AsyncMinioStorage] = None
    default_bucket: Optional[str] = None

    # --- Public API -------------------------------------------------

    async def analyze_code(
        self, code: str, *, context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult:
        """
        Analyze a snippet of code asynchronously and return an AnalysisResult.

        Steps:
        1. Run fast, safe heuristics (regex-based) to detect TODOs, insecure patterns, and probable secrets.
        2. Optionally call a provided async `ai_model.analyze(code)` to enrich results.
        3. Aggregate and return a stable, typed result.
        """
        context = context or {}
        logger.debug("Starting analysis of code; length=%d", len(code))

        # Run heuristics in threadpool to avoid blocking event loop if inputs are large
        heuristics = await asyncio.get_running_loop().run_in_executor(
            None, self._run_heuristics_sync, code
        )

        findings: List[Finding] = heuristics

        # If an AI model is provided, call it to get an augmenting analysis.
        if self.ai_model is not None:
            try:
                logger.debug("Invoking AI model for enriched analysis")
                ai_resp = await asyncio.wait_for(
                    self.ai_model.analyze(code), timeout=5.0
                )
                # Merge/interpret AI response in a defensive manner
                ai_findings = self._interpret_ai_response(ai_resp)
                findings.extend(ai_findings)
            except asyncio.TimeoutError:
                logger.warning("AI model analysis timed out")
            except Exception as exc:
                logger.exception("AI model raised exception during analysis: %s", exc)

        # Build result
        result = AnalysisResult(
            id=self._make_id(),
            timestamp=datetime.utcnow(),
            summary=self._summarize_findings(findings),
            length=len(code),
            findings=findings,
            metadata={"context": context, "ai_used": self.ai_model is not None},
        )
        logger.info("Analysis complete; findings=%d", len(findings))
        return result

    async def analyze_s3_object(
        self,
        key: str,
        bucket: Optional[str] = None,
        *,
        encoding: str = "utf-8",
        context: Optional[Dict[str, Any]] = None,
    ) -> AnalysisResult:
        """
        Fetch an object from S3/MinIO using the injected `storage` and analyze its contents.

        Raises:
            ValueError if storage client is not provided.
        """
        if self.storage is None:
            raise ValueError("storage client is not configured for AnalysisService")

        bucket = bucket or self.default_bucket
        if not bucket:
            raise ValueError(
                "Bucket must be provided either as argument or via default_bucket"
            )

        logger.debug("Fetching object for analysis: %s/%s", bucket, key)
        # Fetch bytes from storage; storage already implements async I/O
        raw = await self.storage.fetch_object_bytes(bucket=bucket, key=key)
        try:
            code = raw.decode(encoding)
        except Exception:
            logger.warning(
                "Failed to decode object %s/%s using %s; falling back to latin-1",
                bucket,
                key,
                encoding,
            )
            code = raw.decode("latin-1", errors="replace")

        return await self.analyze_code(
            code, context={"bucket": bucket, "key": key, **(context or {})}
        )

    # --- Internal helpers ------------------------------------------

    @staticmethod
    def _make_id() -> str:
        """Create a simple unique-ish id for an analysis run."""
        return datetime.utcnow().strftime("analysis-%Y%m%d%H%M%S%f")

    @staticmethod
    def _summarize_findings(findings: List[Finding]) -> str:
        """Produce a brief summary string from findings."""
        if not findings:
            return "no-issues-found"
        severities = {}
        for f in findings:
            severities[f.severity] = severities.get(f.severity, 0) + 1
        parts = [f"{k}:{v}" for k, v in sorted(severities.items(), key=lambda x: x[0])]
        return f"issues_found ({', '.join(parts)})"

    @staticmethod
    def _interpret_ai_response(resp: Any) -> List[Finding]:
        """
        Safely interpret the AI model response. The model is expected to return a dict-like
        structure, but we defensively handle other shapes.

        Example expected shape:
        {
            "summary": "...",
            "findings": [
                {"category": "...", "message": "...", "severity": "low", "location": {"line": 1}}
            ]
        }
        """
        findings: List[Finding] = []
        if not isinstance(resp, dict):
            return findings

        raw_findings = resp.get("findings") or resp.get("issues") or []
        if not isinstance(raw_findings, list):
            return findings

        for idx, f in enumerate(raw_findings):
            try:
                if not isinstance(f, dict):
                    continue
                findings.append(
                    Finding(
                        id=f.get("id") or f"ai-{idx}",
                        category=f.get("category", "ai"),
                        message=f.get("message", "no-message"),
                        severity=f.get("severity", "info"),
                        location=f.get("location"),
                        evidence=f.get("evidence"),
                    )
                )
            except Exception:
                logger.exception("Failed to interpret a single ai finding: %s", f)
                continue
        return findings

    # --- Heuristic detectors (sync) --------------------------------
    # These keep simple CPU-bound work out of the main event loop by being called
    # via run_in_executor by `analyze_code`.

    @staticmethod
    def _run_heuristics_sync(code: str) -> List[Finding]:
        """
        Synchronous heuristics that scan the code text and produce findings.

        Kept synchronous so callers can opt to move it off the event loop using a threadpool.
        """
        findings: List[Finding] = []

        # 1) TODO / FIXME comments
        for match in re.finditer(r"(?i)\\b(?:TODO|FIXME)\\b[:\\-\\s]*(.*)", code):
            message = match.group(0).strip()
            line_no = AnalysisService._line_of_pos(code, match.start())
            findings.append(
                Finding(
                    id=f"todo-{match.start()}",
                    category="todo",
                    message=f"Annotation detected: {message}",
                    severity="info",
                    location={"line": line_no},
                    evidence=message,
                )
            )

        # 2) Insecure patterns (eval, exec, subprocess with shell=True)
        insecure_patterns = [
            (r"\\beval\\s*\\(", "use of eval()"),
            (r"\\bexec\\s*\\(", "use of exec()"),
            (
                r"subprocess\\.Popen\\([^\\)]*shell\\s*=\\s*True",
                "subprocess with shell=True",
            ),
            (
                r"subprocess\\.call\\([^\\)]*shell\\s*=\\s*True",
                "subprocess with shell=True",
            ),
            (r"os\\.system\\s*\\(", "os.system usage"),
        ]
        for pattern, desc in insecure_patterns:
            for m in re.finditer(pattern, code):
                line_no = AnalysisService._line_of_pos(code, m.start())
                findings.append(
                    Finding(
                        id=f"insecure-{m.start()}",
                        category="security",
                        message=desc,
                        severity="high",
                        location={"line": line_no},
                        evidence=code[m.start() : m.end()],
                    )
                )

        # 3) Probable secrets (very naive: long hex/base64-like strings, or AWS keys)
        # NOTE: This is intentionally conservative and heuristic-based only.
        secret_patterns = [
            (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID pattern"),
            (
                r"(?i)(?:secret|api|token)[\"']?\\s*[:=]\\s*[\"']([A-Za-z0-9_\\-./+]{20,200})[\"']",
                "Likely secret assignment",
            ),
            (r"[A-Za-z0-9+/]{40,}={0,2}", "Long Base64-like string"),
        ]
        for pattern, desc in secret_patterns:
            for m in re.finditer(pattern, code):
                line_no = AnalysisService._line_of_pos(code, m.start())
                evidence = m.group(0)
                findings.append(
                    Finding(
                        id=f"secret-{m.start()}",
                        category="secrets",
                        message=desc,
                        severity="critical" if len(evidence) > 40 else "medium",
                        location={"line": line_no},
                        evidence=(evidence[:200] + "...")
                        if len(evidence) > 200
                        else evidence,
                    )
                )

        # 4) Simple style heuristics: very long functions (heuristic: > 300 lines between def/class)
        for m in re.finditer(r"^(def|class)\\s+\\w+", code, flags=re.MULTILINE):
            start = m.start()
            # find next def/class or end of file
            next_match = re.search(
                r"^(def|class)\\s+\\w+", code[m.end() :], flags=re.MULTILINE
            )
            end_pos = (m.end() + next_match.start()) if next_match else len(code)
            lines = AnalysisService._line_of_pos(
                code, end_pos
            ) - AnalysisService._line_of_pos(code, start)
            if lines and lines > 300:
                findings.append(
                    Finding(
                        id=f"long-block-{start}",
                        category="maintainability",
                        message=f"Large block (~{lines} lines) starting at line {AnalysisService._line_of_pos(code, start)}",
                        severity="low",
                        location={"line": AnalysisService._line_of_pos(code, start)},
                    )
                )

        return findings

    @staticmethod
    def _line_of_pos(text: str, pos: int) -> int:
        """Return 1-based line number for a character position."""
        return text.count("\n", 0, pos) + 1


__all__ = ["AnalysisService", "AnalysisResult", "Finding"]
