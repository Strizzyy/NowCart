"""PII redaction middleware — masks phone numbers and emails in request logs.

This middleware intercepts request bodies, redacts PII patterns before the
body is logged, and passes the original body through to the endpoint unchanged.
Redaction only affects the logged representation, never the actual request data.
"""
import re
import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("nowcart.pii")

# Patterns for common PII
_PHONE_PATTERN = re.compile(r"\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_INDIAN_PHONE_PATTERN = re.compile(r"\b(\+91[-.\s]?)?\d{10}\b")


def redact_pii(text: str) -> str:
    """Replace phone numbers and emails with [REDACTED]."""
    text = _EMAIL_PATTERN.sub("[EMAIL_REDACTED]", text)
    text = _INDIAN_PHONE_PATTERN.sub("[PHONE_REDACTED]", text)
    text = _PHONE_PATTERN.sub("[PHONE_REDACTED]", text)
    return text


class PiiRedactionMiddleware(BaseHTTPMiddleware):
    """Log request bodies with PII redacted; pass original data through."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Only log+redact for POST/PUT/PATCH with a body
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = await request.body()
                if body:
                    redacted = redact_pii(body.decode("utf-8", errors="replace"))
                    logger.debug("Request %s %s body: %s", request.method, request.url.path, redacted)
            except Exception:
                pass  # Don't break the request if logging fails

        response = await call_next(request)
        return response
