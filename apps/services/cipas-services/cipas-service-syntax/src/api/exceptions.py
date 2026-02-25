"""
Custom exceptions and middleware for the API.
"""

from typing import Any, Optional

from fastapi import Request, status
from fastapi.middleware import Middleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.message)


class ModelNotLoadedError(AppException):
    """Raised when the ML model is not loaded."""

    def __init__(self, message: str = "Model not loaded"):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class CodeValidationError(AppException):
    """Raised when code validation fails."""

    def __init__(self, message: str = "Invalid code input"):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class LanguageNotSupportedError(AppException):
    """Raised when an unsupported language is requested."""

    def __init__(self, language: str):
        super().__init__(
            message=f"Language '{language}' is not supported",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class AppExceptionMiddleware(BaseHTTPMiddleware):
    """Middleware to handle application exceptions."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except AppException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={
                    "error": True,
                    "message": e.message,
                    "detail": e.detail,
                },
            )
        except Exception as e:
            # Log the exception
            import traceback

            traceback.print_exc()

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": True,
                    "message": f"Internal server error: {str(e)}",
                },
            )
