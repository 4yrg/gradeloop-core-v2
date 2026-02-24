"""
Per-process formatter configuration storage for CIPAS normalisation workers.

This module provides mutable module-level globals that are set once by
_normalization_worker_init() in service.py when a new worker process starts.
These globals are then read by run_normalization_worker() (and the underlying
format_source() call) so that every task executed by the worker uses the
same formatter configuration that the service process was started with.

Why module-level globals?
──────────────────────────
ProcessPoolExecutor worker processes are plain OS processes.  The only safe
mechanism to pass configuration to them at initialisation time is via the
initializer / initargs parameters of ProcessPoolExecutor.  The initialiser
sets these module-level globals; subsequent task functions (which are also
module-level and therefore picklable) read them without needing to carry the
configuration in every task's argument dict.

This avoids pickle-serialising the formatter config on every single granule
task dispatch, which would add overhead proportional to batch size.

Thread safety
──────────────
Each worker process is single-threaded with respect to task execution
(ProcessPoolExecutor submits one task at a time per worker).  These globals
are written once (in the initialiser) and read-only thereafter.  No locking
is required.

Values
───────
JAVA_FORMATTER_JAR
  Absolute path to the google-java-format JAR file.
  Empty string = JAR not configured; fall back to PATH lookup or stripped text.

BLACK_VERSION_PREFIX
  Expected version prefix for the black binary, e.g. "24." to require black 24.x.
  Empty string = version pinning disabled.

CLANG_FORMAT_MAJOR_VERSION
  Expected major version integer for the clang-format binary, e.g. 17.
  0 = version pinning disabled.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Mutable worker-process globals
# ---------------------------------------------------------------------------

# Path to the google-java-format JAR.  Set by _normalization_worker_init().
JAVA_FORMATTER_JAR: str = ""

# Expected black version prefix for the version-pin check.
# Set by _normalization_worker_init().
BLACK_VERSION_PREFIX: str = "24."

# Expected clang-format major version for the version-pin check.
# Set by _normalization_worker_init().
CLANG_FORMAT_MAJOR_VERSION: int = 0

# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "JAVA_FORMATTER_JAR",
    "BLACK_VERSION_PREFIX",
    "CLANG_FORMAT_MAJOR_VERSION",
]
