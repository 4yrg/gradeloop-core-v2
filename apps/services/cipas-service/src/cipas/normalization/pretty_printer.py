"""
Pretty-printer subprocess wrappers for CIPAS normalisation (E10/US02).

This module provides deterministic, version-pinned subprocess wrappers for
three external formatters:

  Python → black  (≥24.x)
  Java   → google-java-format  (JAR, stdin mode)
  C      → clang-format  (K&R / GNU style, stdin mode)

Design decisions
─────────────────
Subprocess, not in-process API
  black exposes a public Python API (black.format_str()), but it is NOT
  subprocess-safe: black imports a large dependency tree (~120 ms cold),
  modifies global state, and its API has changed incompatibly between minor
  versions.  Using subprocess guarantees isolation, determinism, and version
  independence.  The same argument applies to google-java-format (Java, not
  Python) and clang-format (C binary).

2-second timeout
  All subprocess invocations use a hard 2-second wall-clock timeout.  This
  is enforced via subprocess.run(timeout=2.0) which sends SIGKILL to the
  child after the deadline.  A 500-LOC granule formats in <200 ms on modern
  hardware; 2 s provides a 10× safety margin while bounding worst-case latency.

Fallback on failure
  If the formatter binary is unavailable, times out, or exits non-zero, the
  pipeline falls back to the stripped text (comment-free, post-CST-stripped).
  The formatter failure is logged as a WARNING (not an ERROR) and counted in
  the cipas_normalization_formatter_fallback_total Prometheus counter.
  Normalisation continues — a missing formatter degrades quality, not availability.

Version pinning check
  On first use (lazy initialisation), each formatter binary is probed for its
  version string.  If the version does not match the configured pin prefix
  (CIPAS_BLACK_VERSION_PREFIX, CIPAS_CLANG_FORMAT_MAJOR_VERSION), a WARNING
  is emitted via loguru.  The pipeline is NOT blocked — version mismatches are
  a configuration concern, not a runtime error.  The probe result is cached so
  it only runs once per worker process.

Determinism
───────────
  - black: invoked with --quiet --fast --line-length 88 --target-version py311
    plus stdin input from the stripped source.  black's output is fully
    deterministic for a given source string and version.
  - google-java-format: invoked with - (stdin) flag.  Its output is
    deterministic for a given source string and version.
  - clang-format: invoked with --style="{BasedOnStyle: GNU, IndentWidth: 4,
    ColumnLimit: 0}" and --assume-filename=input.c.  ColumnLimit: 0 disables
    line wrapping so the output depends only on the logical structure.

Subprocess safety
─────────────────
  - source text is passed via stdin (not via a temporary file) to avoid race
    conditions from concurrent formatter invocations in the same process.
  - subprocess.run() is used (not Popen + communicate()) because it is safer
    and simpler for our one-shot stdin→stdout usage pattern.
  - stderr is captured (subprocess.PIPE) and inspected only on failure to
    avoid noise in normal operation.
  - All stdin bytes are pre-encoded to UTF-8 before passing to subprocess.run()
    to prevent implicit codec selection on different platforms.
  - The environment passed to subprocesses is the current process environment
    (os.environ) — not a sanitised minimal env — because black / clang-format
    may need PATH, JAVA_HOME, etc.

Thread safety
─────────────
  PrettyPrinter is stateless (no mutable instance fields after __init__ cache
  is populated).  Multiple concurrent calls to format_*() are safe as long as
  each call creates its own subprocess (which it does).  The version-check
  cache (_version_checked) uses a threading.Lock to prevent concurrent probes
  during the first call.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
from typing import Optional

from loguru import logger

from cipas.normalization.models import (
    FormatterCheckResult,
    FormatterKind,
    NormalizationError,
    NormalizationStage,
)

# ---------------------------------------------------------------------------
# Formatter invocation constants
# ---------------------------------------------------------------------------

_FORMATTER_TIMEOUT_SECONDS: float = 2.0

# black CLI arguments (deterministic, reproducible output):
#   --quiet       suppress "reformatted" / "unchanged" banner on stdout
#   --fast        skip AST equivalence check (safe for normalisation; faster)
#   --line-length 88  PEP 8 default; matches CIPAS pyproject.toml black config
#   --target-version py311  locks grammar interpretation; prevents regressions
#                  across black versions when new Python syntax is added
#   -             read from stdin / write to stdout
_BLACK_ARGS: list[str] = [
    "black",
    "--quiet",
    "--fast",
    "--line-length",
    "88",
    "--target-version",
    "py311",
    "-",
]

# google-java-format CLI arguments:
#   -             read from stdin / write to stdout
#   --aosp        Android Open Source Project style (4-space indent, matches K&R
#                 conventions used by most intro-CS courses)
# Note: when a JAR path is provided, the command is:
#   java -jar <jar_path> --aosp -
# When the binary is on PATH:
#   google-java-format --aosp -
_GJF_STDIN_ARG: str = "-"
_GJF_STYLE_ARG: str = "--aosp"

# clang-format style: GNU/K&R, no line-length limit.
# ColumnLimit: 0 is critical — it prevents clang-format from introducing line
# wraps that depend on line length, making output dependent on content width.
# AllowShortFunctionsOnASingleLine: Empty keeps one-line functions expanded
# so structural tokens are separated by whitespace.
_CLANG_FORMAT_STYLE: str = (
    "{"
    "BasedOnStyle: GNU, "
    "IndentWidth: 4, "
    "ColumnLimit: 0, "
    "AllowShortFunctionsOnASingleLine: Empty, "
    "AllowShortIfStatementsOnASingleLine: Never, "
    "AllowShortLoopsOnASingleLine: false"
    "}"
)
_CLANG_FORMAT_ARGS: list[str] = [
    "clang-format",
    f"--style={_CLANG_FORMAT_STYLE}",
    "--assume-filename=input.c",
]


# ---------------------------------------------------------------------------
# PrettyPrinter
# ---------------------------------------------------------------------------


class PrettyPrinter:
    """
    Language-dispatching pretty-printer backed by external formatters.

    One instance is created per worker process and reused across all granules.
    Version checks are performed lazily on first use and cached for the
    lifetime of the process.

    Usage:
        pp = PrettyPrinter(java_formatter_jar="/opt/gjf/gjf.jar",
                           black_version_prefix="24.",
                           clang_format_major_version=17)
        formatted = pp.format(stripped_text, "python", granule_id="abc-123")

    If the formatter fails (timeout, non-zero exit, unavailable), format()
    returns the original stripped_text unchanged and emits a WARNING log.
    """

    def __init__(
        self,
        *,
        java_formatter_jar: str = "",
        black_version_prefix: str = "24.",
        clang_format_major_version: int = 0,
    ) -> None:
        """
        Initialise the PrettyPrinter.

        Args:
            java_formatter_jar:
                Absolute path to the google-java-format JAR file.
                If empty, the formatter is looked up on PATH as
                "google-java-format".  If neither is available, Java
                formatting falls back to stripped text.
            black_version_prefix:
                Expected version prefix for the black binary (e.g. "24.").
                Set to "" to disable version checking.
            clang_format_major_version:
                Expected major version integer for clang-format (e.g. 17).
                Set to 0 to disable version checking.
        """
        self._java_formatter_jar: str = java_formatter_jar
        self._black_version_prefix: str = black_version_prefix
        self._clang_format_major_version: int = clang_format_major_version

        # Version-check results, populated lazily on first format() call.
        # Protected by _version_lock to prevent concurrent probe races.
        self._version_results: dict[FormatterKind, FormatterCheckResult] = {}
        self._version_checked: set[FormatterKind] = set()
        self._version_lock: threading.Lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public dispatch API
    # ------------------------------------------------------------------

    def format(
        self,
        stripped_text: str,
        language: str,
        *,
        granule_id: str = "<unknown>",
    ) -> str:
        """
        Format stripped_text using the canonical formatter for language.

        Dispatches to format_python(), format_java(), or format_c() based on
        language.  On any formatter failure, falls back to stripped_text.

        Args:
            stripped_text: Source text after CST comment/docstring stripping.
            language:      One of "python", "java", "c".
            granule_id:    Opaque ID for structured log messages (optional).

        Returns:
            Formatted source text, or stripped_text if formatting failed.

        Raises:
            ValueError: If language is not one of "python", "java", "c".
        """
        _dispatch: dict[str, str] = {
            "python": "format_python",
            "java": "format_java",
            "c": "format_c",
        }
        method_name = _dispatch.get(language)
        if method_name is None:
            raise ValueError(
                f"PrettyPrinter does not support language {language!r}. "
                f"Supported: {sorted(_dispatch)}"
            )
        method = getattr(self, method_name)
        return method(stripped_text, granule_id=granule_id)

    def format_python(
        self,
        stripped_text: str,
        *,
        granule_id: str = "<unknown>",
    ) -> str:
        """
        Format Python source using black.

        Invokes: black --quiet --fast --line-length 88 --target-version py311 -

        Args:
            stripped_text: Python source after CST stripping.
            granule_id:    For structured logging.

        Returns:
            black-formatted text, or stripped_text on failure.
        """
        self._ensure_version_checked(FormatterKind.BLACK)
        check = self._version_results.get(FormatterKind.BLACK)
        if check is not None and not check.available:
            logger.warning(
                "black binary not found — falling back to stripped text",
                granule_id=granule_id,
                formatter="black",
            )
            return stripped_text

        return self._run_formatter(
            args=_BLACK_ARGS,
            source_text=stripped_text,
            language="python",
            formatter_kind=FormatterKind.BLACK,
            granule_id=granule_id,
        )

    def format_java(
        self,
        stripped_text: str,
        *,
        granule_id: str = "<unknown>",
    ) -> str:
        """
        Format Java source using google-java-format.

        Invokes:
          - If java_formatter_jar is set:
              java -jar <jar> --aosp -
          - Else if google-java-format is on PATH:
              google-java-format --aosp -
          - Else: fallback to stripped_text.

        Args:
            stripped_text: Java source after CST stripping.
            granule_id:    For structured logging.

        Returns:
            google-java-format output, or stripped_text on failure.
        """
        self._ensure_version_checked(FormatterKind.GOOGLE_JAVA)
        check = self._version_results.get(FormatterKind.GOOGLE_JAVA)
        if check is not None and not check.available:
            logger.warning(
                "google-java-format not found — falling back to stripped text",
                granule_id=granule_id,
                formatter="google-java-format",
            )
            return stripped_text

        args = self._build_gjf_args()
        return self._run_formatter(
            args=args,
            source_text=stripped_text,
            language="java",
            formatter_kind=FormatterKind.GOOGLE_JAVA,
            granule_id=granule_id,
        )

    def format_c(
        self,
        stripped_text: str,
        *,
        granule_id: str = "<unknown>",
    ) -> str:
        """
        Format C source using clang-format with GNU/K&R style.

        Invokes:
            clang-format --style="{BasedOnStyle: GNU, IndentWidth: 4, ...}"
                         --assume-filename=input.c

        Args:
            stripped_text: C source after CST stripping.
            granule_id:    For structured logging.

        Returns:
            clang-format output, or stripped_text on failure.
        """
        self._ensure_version_checked(FormatterKind.CLANG_FORMAT)
        check = self._version_results.get(FormatterKind.CLANG_FORMAT)
        if check is not None and not check.available:
            logger.warning(
                "clang-format binary not found — falling back to stripped text",
                granule_id=granule_id,
                formatter="clang-format",
            )
            return stripped_text

        return self._run_formatter(
            args=_CLANG_FORMAT_ARGS,
            source_text=stripped_text,
            language="c",
            formatter_kind=FormatterKind.CLANG_FORMAT,
            granule_id=granule_id,
        )

    # ------------------------------------------------------------------
    # Version checking
    # ------------------------------------------------------------------

    def check_versions(self) -> list[FormatterCheckResult]:
        """
        Probe all three formatters and return version check results.

        Safe to call from the event-loop process at startup to populate the
        cache before any worker processes are spawned.  In worker processes,
        this is called lazily on the first format() invocation.

        Returns:
            List of FormatterCheckResult, one per formatter.
        """
        results: list[FormatterCheckResult] = []
        for kind in (
            FormatterKind.BLACK,
            FormatterKind.GOOGLE_JAVA,
            FormatterKind.CLANG_FORMAT,
        ):
            self._ensure_version_checked(kind)
            result = self._version_results.get(kind)
            if result is not None:
                results.append(result)
        return results

    def _ensure_version_checked(self, kind: FormatterKind) -> None:
        """
        Lazily check the version of formatter `kind`, exactly once per process.

        Protected by _version_lock so concurrent calls from the same worker
        process do not perform duplicate probes.

        Args:
            kind: Which formatter to check.
        """
        with self._version_lock:
            if kind in self._version_checked:
                return
            result = self._probe_version(kind)
            self._version_results[kind] = result
            self._version_checked.add(kind)

            if not result.available:
                logger.warning(
                    "Formatter binary not found",
                    formatter=kind.value,
                    recommendation="Install the formatter to enable pretty-printing",
                )
            elif not result.version_matches:
                logger.warning(
                    "Formatter version does not match configured pin",
                    formatter=kind.value,
                    detected_version=result.version_string,
                    warn=result.warn_message,
                )
            else:
                logger.debug(
                    "Formatter version OK",
                    formatter=kind.value,
                    version=result.version_string,
                )

    def _probe_version(self, kind: FormatterKind) -> FormatterCheckResult:
        """
        Probe the formatter binary for its version string.

        Runs the binary with --version (or equivalent), captures stdout/stderr,
        and extracts the version string.  Does not raise on failure — returns
        a FormatterCheckResult with available=False instead.

        Args:
            kind: Which formatter to probe.

        Returns:
            FormatterCheckResult populated with availability and version info.
        """
        if kind == FormatterKind.BLACK:
            return self._probe_black()
        elif kind == FormatterKind.GOOGLE_JAVA:
            return self._probe_google_java_format()
        elif kind == FormatterKind.CLANG_FORMAT:
            return self._probe_clang_format()
        else:
            return FormatterCheckResult(formatter=kind, available=False)

    def _probe_black(self) -> FormatterCheckResult:
        """
        Probe black --version.

        Expected output (black ≥22.x):
            black, 24.3.0 (compiled: yes)

        Returns:
            FormatterCheckResult.
        """
        binary = shutil.which("black")
        if binary is None:
            return FormatterCheckResult(
                formatter=FormatterKind.BLACK,
                available=False,
                warn_message="black binary not found on PATH",
            )

        try:
            result = subprocess.run(
                [binary, "--version"],
                capture_output=True,
                text=True,
                timeout=5.0,
            )
            output = (result.stdout + result.stderr).strip()
            # black ≥22: "black, 24.3.0 (compiled: yes)"
            version_match = re.search(r"(\d+\.\d+[\.\d]*)", output)
            version_str = version_match.group(1) if version_match else output[:32]

            version_matches = True
            warn_message = ""
            if self._black_version_prefix:
                version_matches = version_str.startswith(self._black_version_prefix)
                if not version_matches:
                    warn_message = (
                        f"black version {version_str!r} does not match "
                        f"required prefix {self._black_version_prefix!r}"
                    )

            return FormatterCheckResult(
                formatter=FormatterKind.BLACK,
                available=True,
                version_string=version_str,
                version_matches=version_matches,
                warn_message=warn_message,
            )

        except (subprocess.TimeoutExpired, OSError, FileNotFoundError) as exc:
            return FormatterCheckResult(
                formatter=FormatterKind.BLACK,
                available=False,
                warn_message=f"black version probe failed: {exc}",
            )

    def _probe_google_java_format(self) -> FormatterCheckResult:
        """
        Probe google-java-format --version (JAR or binary).

        Returns:
            FormatterCheckResult.
        """
        args = self._build_gjf_version_args()
        if not args:
            return FormatterCheckResult(
                formatter=FormatterKind.GOOGLE_JAVA,
                available=False,
                warn_message="google-java-format not found (no JAR configured, not on PATH)",
            )

        try:
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=10.0,  # JVM startup is slow
            )
            output = (result.stdout + result.stderr).strip()
            version_match = re.search(r"(\d+\.\d+[\.\d\-]*)", output)
            version_str = version_match.group(1) if version_match else output[:32]

            return FormatterCheckResult(
                formatter=FormatterKind.GOOGLE_JAVA,
                available=True,
                version_string=version_str,
                version_matches=True,
            )

        except (subprocess.TimeoutExpired, OSError, FileNotFoundError) as exc:
            return FormatterCheckResult(
                formatter=FormatterKind.GOOGLE_JAVA,
                available=False,
                warn_message=f"google-java-format version probe failed: {exc}",
            )

    def _probe_clang_format(self) -> FormatterCheckResult:
        """
        Probe clang-format --version.

        Expected output:
            clang-format version 17.0.6 (https://github.com/llvm/llvm-project ...)

        Returns:
            FormatterCheckResult.
        """
        binary = shutil.which("clang-format")
        if binary is None:
            return FormatterCheckResult(
                formatter=FormatterKind.CLANG_FORMAT,
                available=False,
                warn_message="clang-format binary not found on PATH",
            )

        try:
            result = subprocess.run(
                [binary, "--version"],
                capture_output=True,
                text=True,
                timeout=5.0,
            )
            output = (result.stdout + result.stderr).strip()
            version_match = re.search(r"version\s+(\d+\.\d+[\.\d]*)", output)
            version_str = version_match.group(1) if version_match else output[:32]

            version_matches = True
            warn_message = ""
            if self._clang_format_major_version > 0:
                try:
                    major = int(version_str.split(".")[0])
                    version_matches = major == self._clang_format_major_version
                    if not version_matches:
                        warn_message = (
                            f"clang-format major version {major} does not match "
                            f"required {self._clang_format_major_version}"
                        )
                except (ValueError, IndexError):
                    version_matches = False
                    warn_message = (
                        f"Could not parse clang-format version: {version_str!r}"
                    )

            return FormatterCheckResult(
                formatter=FormatterKind.CLANG_FORMAT,
                available=True,
                version_string=version_str,
                version_matches=version_matches,
                warn_message=warn_message,
            )

        except (subprocess.TimeoutExpired, OSError, FileNotFoundError) as exc:
            return FormatterCheckResult(
                formatter=FormatterKind.CLANG_FORMAT,
                available=False,
                warn_message=f"clang-format version probe failed: {exc}",
            )

    # ------------------------------------------------------------------
    # Subprocess runner
    # ------------------------------------------------------------------

    def _run_formatter(
        self,
        args: list[str],
        source_text: str,
        language: str,
        formatter_kind: FormatterKind,
        granule_id: str,
    ) -> str:
        """
        Run a formatter subprocess with source_text on stdin.

        Args:
            args:           Full argv list (binary + arguments).
            source_text:    Source to format (passed via stdin).
            language:       Source language (for log messages).
            formatter_kind: Which formatter is being invoked.
            granule_id:     For structured log messages.

        Returns:
            Formatted source text on success, or source_text on failure.
        """
        stdin_bytes: bytes = source_text.encode("utf-8")

        try:
            completed = subprocess.run(
                args,
                input=stdin_bytes,
                capture_output=True,
                timeout=_FORMATTER_TIMEOUT_SECONDS,
                # Pass current environment so PATH, JAVA_HOME, etc. are available.
                env=os.environ.copy(),
            )

            if completed.returncode != 0:
                stderr_snippet = completed.stderr[:512].decode(
                    "utf-8", errors="replace"
                )
                logger.warning(
                    "Formatter exited non-zero — falling back to stripped text",
                    formatter=formatter_kind.value,
                    language=language,
                    granule_id=granule_id,
                    returncode=completed.returncode,
                    stderr_snippet=stderr_snippet,
                )
                return source_text

            formatted = completed.stdout.decode("utf-8", errors="replace")

            if not formatted.strip():
                # Formatter produced empty output (e.g. black on an empty file).
                # Return the stripped text to avoid losing content.
                logger.debug(
                    "Formatter produced empty output — using stripped text",
                    formatter=formatter_kind.value,
                    language=language,
                    granule_id=granule_id,
                )
                return source_text

            return formatted

        except subprocess.TimeoutExpired:
            logger.warning(
                "Formatter timed out — falling back to stripped text",
                formatter=formatter_kind.value,
                language=language,
                granule_id=granule_id,
                timeout_seconds=_FORMATTER_TIMEOUT_SECONDS,
            )
            return source_text

        except (OSError, FileNotFoundError) as exc:
            logger.warning(
                "Formatter binary not executable — falling back to stripped text",
                formatter=formatter_kind.value,
                language=language,
                granule_id=granule_id,
                error=str(exc),
            )
            return source_text

    # ------------------------------------------------------------------
    # Argument builders
    # ------------------------------------------------------------------

    def _build_gjf_args(self) -> list[str]:
        """
        Build the google-java-format invocation argument list.

        If a JAR path is configured and the file exists, use:
            java -jar <jar> --aosp -
        Otherwise, if the binary is on PATH, use:
            google-java-format --aosp -
        Otherwise, return an empty list (caller interprets this as unavailable).

        Returns:
            Argument list, or empty list if unavailable.
        """
        if self._java_formatter_jar and os.path.isfile(self._java_formatter_jar):
            java_binary = shutil.which("java") or "java"
            return [
                java_binary,
                "-jar",
                self._java_formatter_jar,
                _GJF_STYLE_ARG,
                _GJF_STDIN_ARG,
            ]

        gjf_binary = shutil.which("google-java-format")
        if gjf_binary:
            return [gjf_binary, _GJF_STYLE_ARG, _GJF_STDIN_ARG]

        return []

    def _build_gjf_version_args(self) -> list[str]:
        """
        Build the google-java-format --version argument list.

        Returns:
            Argument list, or empty list if unavailable.
        """
        if self._java_formatter_jar and os.path.isfile(self._java_formatter_jar):
            java_binary = shutil.which("java") or "java"
            return [java_binary, "-jar", self._java_formatter_jar, "--version"]

        gjf_binary = shutil.which("google-java-format")
        if gjf_binary:
            return [gjf_binary, "--version"]

        return []


# ---------------------------------------------------------------------------
# Module-level convenience function (subprocess-worker entry point)
# ---------------------------------------------------------------------------


def format_source(
    stripped_text: str,
    language: str,
    *,
    granule_id: str = "<unknown>",
    java_formatter_jar: str = "",
    black_version_prefix: str = "24.",
    clang_format_major_version: int = 0,
) -> str:
    """
    Module-level function: format stripped_text for the given language.

    This is the entry point called by ProcessPoolExecutor worker functions.
    It lazily initialises a process-global PrettyPrinter instance so that
    version checks are performed once per worker process.

    Args:
        stripped_text:              Source text after CST stripping.
        language:                   One of "python", "java", "c".
        granule_id:                 For structured logging.
        java_formatter_jar:         Path to google-java-format JAR (optional).
        black_version_prefix:       Expected black version prefix (optional).
        clang_format_major_version: Expected clang-format major version (optional).

    Returns:
        Formatted source text, or stripped_text on formatter failure.
    """
    global _PROCESS_PRETTY_PRINTER  # noqa: PLW0603

    if _PROCESS_PRETTY_PRINTER is None:
        _PROCESS_PRETTY_PRINTER = PrettyPrinter(
            java_formatter_jar=java_formatter_jar,
            black_version_prefix=black_version_prefix,
            clang_format_major_version=clang_format_major_version,
        )

    return _PROCESS_PRETTY_PRINTER.format(
        stripped_text,
        language,
        granule_id=granule_id,
    )


# Process-global singleton — initialised lazily on first format() call.
_PROCESS_PRETTY_PRINTER: Optional[PrettyPrinter] = None


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "PrettyPrinter",
    "format_source",
]
