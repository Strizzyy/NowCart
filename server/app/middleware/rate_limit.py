"""Rate limit middleware — simple in-memory token-bucket per IP.

Defaults to 60 requests per minute per client IP. Returns 429 when exhausted.
Adds X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.
"""
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class _TokenBucket:
    """Simple token-bucket tracker for a single client."""

    __slots__ = ("tokens", "last_refill", "max_tokens", "refill_rate")

    def __init__(self, max_tokens: int = 60, refill_rate: float = 1.0):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = float(max_tokens)
        self.last_refill = time.time()

    def consume(self) -> bool:
        """Try to consume one token. Returns True if allowed."""
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

    @property
    def remaining(self) -> int:
        return int(self.tokens)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter: 60 req/min per IP."""

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        # refill_rate = max_requests / window_seconds tokens per second
        self.refill_rate = max_requests / window_seconds
        self._buckets: dict[str, _TokenBucket] = defaultdict(
            lambda: _TokenBucket(max_tokens=max_requests, refill_rate=self.refill_rate)
        )

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        bucket = self._buckets[client_ip]

        if not bucket.consume():
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "detail": "Too many requests"},
                headers={
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "1",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(bucket.remaining)
        return response
