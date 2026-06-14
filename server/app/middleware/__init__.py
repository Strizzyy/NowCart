"""Middleware — cross-cutting concerns (Requirement 9.5).

Modules:
- request_id     attach a correlation id to every request/response
- rate_limit     simple token-bucket per client (60 req/min)
- pii_redaction  mask phone/email before logging
- telemetry      request timing, pipeline metrics, observability
"""
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.pii_redaction import PiiRedactionMiddleware
from app.middleware.telemetry import TelemetryMiddleware

__all__ = ["RequestIdMiddleware", "RateLimitMiddleware", "PiiRedactionMiddleware", "TelemetryMiddleware"]
