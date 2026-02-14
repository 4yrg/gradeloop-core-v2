import logging
import json
import os
import datetime
import uuid
from contextvars import ContextVar
from typing import Any, Dict, Optional

# Context variable to store trace_id for the duration of a request/task
_trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="")

SENSITIVE_FIELDS = {
    "password", "password_hash", "token", "token_hash", "secret",
    "api_key", "ssn", "credit_card", "email", "phone_number", "address", "authorization"
}

class StructuredJSONFormatter(logging.Formatter):
    """
    Standardized JSON Formatter for GradeLoop services.
    Ensures mandatory schema and redaction of sensitive fields.
    """
    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        # Extract trace_id from context or record
        trace_id = getattr(record, "trace_id", _trace_id_ctx.get())
        if not trace_id:
            # Generate internal ID for background jobs/missing context
            trace_id = f"internal-{uuid.uuid4()}"

        # Mandatory Schema
        log_entry = {
            "timestamp": datetime.datetime.fromtimestamp(record.created).isoformat(),
            "service_name": self.service_name,
            "level": record.levelname,
            "msg": record.getMessage(),
            "trace_id": trace_id
        }

        # Add extra fields if they exist, with redaction and circular reference safety
        if hasattr(record, "extra_fields") and isinstance(record.extra_fields, dict):
            for key, value in record.extra_fields.items():
                if key not in log_entry:
                    log_entry[key] = self._redact_and_safe(key, value)

        # Handle explicit 'extra' passed to logger.info(..., extra={})
        # Standard logging adds everything in extra to the record __dict__
        # We want to avoid internal logging attributes
        internal_attrs = {
            'args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
            'funcName', 'levelname', 'levelno', 'lineno', 'module', 'msecs',
            'msg', 'name', 'pathname', 'process', 'processName', 'relativeCreated',
            'stack_info', 'thread', 'threadName', 'trace_id', 'extra_fields'
        }

        for key, value in record.__dict__.items():
            if key not in internal_attrs and key not in log_entry:
                log_entry[key] = self._redact_and_safe(key, value)

        try:
            return json.dumps(log_entry, default=str)
        except Exception:
            # Fallback for circular references or non-serializable objects
            return json.dumps({
                "timestamp": log_entry["timestamp"],
                "service_name": self.service_name,
                "level": "ERROR",
                "msg": "Failed to serialize log entry",
                "trace_id": trace_id
            })

    def _redact_and_safe(self, key: str, value: Any) -> Any:
        if str(key).lower() in SENSITIVE_FIELDS:
            return "[REDACTED]"
        return value

def get_logger(service_name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Creates and configures a structured logger.
    """
    logger = logging.getLogger(service_name)
    logger.setLevel(level)

    # Prevent duplicate handlers if get_logger is called multiple times
    if not logger.handlers:
        # Standard Output requirement
        handler = logging.StreamHandler(os.sys.stdout)
        formatter = StructuredJSONFormatter(service_name)
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    # Prevent propagation to root logger to avoid double logging
    logger.propagate = False
    return logger

def set_trace_id(trace_id: str):
    """Sets the trace_id in the current context."""
    _trace_id_ctx.set(trace_id)

def get_trace_id() -> str:
    """Retrieves the trace_id from the current context."""
    return _trace_id_ctx.get()
