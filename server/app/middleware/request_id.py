"""Request ID middleware — attaches a unique X-Request-ID header to every response.

If the incoming request already carries an X-Request-ID header, it is preserved;
otherwise a new UUID is generated. The ID is also stored on request.state for
use in logging/error responses.
"""
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID to every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Use existing header or generate a new one
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
