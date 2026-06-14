"""Telemetry middleware — request-level timing and pipeline observability.

Records per-request metrics:
- Total request duration
- Route/path
- Status code
- LLM node timings (when available via request.state)

Exposes metrics via /api/meta/stats for observability dashboards
and hackathon demo ("we think about production readiness").
"""
import time
from collections import defaultdict
from dataclasses import dataclass, field

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RequestMetrics:
    """Accumulated metrics for the /api/meta/stats endpoint."""

    total_requests: int = 0
    total_errors: int = 0
    total_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    requests_by_path: dict = field(default_factory=lambda: defaultdict(int))
    requests_by_status: dict = field(default_factory=lambda: defaultdict(int))
    # Pipeline-specific metrics
    carts_built: int = 0
    avg_items_per_cart: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0
    llm_calls: int = 0
    avg_llm_latency_ms: float = 0.0
    # Keep last N latencies for percentile calculation
    _recent_latencies: list = field(default_factory=list)
    _max_recent: int = 1000


# Module-level singleton — shared across all requests
metrics = RequestMetrics()


class TelemetryMiddleware(BaseHTTPMiddleware):
    """Track request timing, status codes, and path-level metrics.

    Adds X-Response-Time header to every response for client-side observability.
    Logs slow requests (>2s) as warnings for debugging.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()

        # Store start time on request.state for pipeline nodes to use
        request.state.start_time = start

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start) * 1000.0
        path = request.url.path
        status = response.status_code

        # Update metrics
        metrics.total_requests += 1
        metrics.total_latency_ms += duration_ms
        metrics.avg_latency_ms = metrics.total_latency_ms / metrics.total_requests
        metrics.requests_by_path[path] += 1
        metrics.requests_by_status[str(status)] += 1

        if status >= 400:
            metrics.total_errors += 1

        # Track cart-building endpoints
        if path in ("/api/outcome", "/api/constraint", "/api/sos", "/api/voice/intent",
                    "/api/vision/analyze", "/api/share/parse") and status == 200:
            metrics.carts_built += 1

        # Recent latencies for percentile calculation
        metrics._recent_latencies.append(duration_ms)
        if len(metrics._recent_latencies) > metrics._max_recent:
            metrics._recent_latencies = metrics._recent_latencies[-metrics._max_recent:]

        # P95 calculation
        if len(metrics._recent_latencies) >= 10:
            sorted_latencies = sorted(metrics._recent_latencies)
            p95_idx = int(len(sorted_latencies) * 0.95)
            metrics.p95_latency_ms = sorted_latencies[p95_idx]

        # Add timing header
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

        # Log slow requests
        if duration_ms > 2000:
            logger.warning(
                "Slow request: %s %s took %.0fms (status=%d)",
                request.method, path, duration_ms, status,
            )
        else:
            logger.debug(
                "%s %s → %d (%.0fms)",
                request.method, path, status, duration_ms,
            )

        return response


def get_metrics_snapshot() -> dict:
    """Return a serializable snapshot of current metrics for the /api/meta/stats endpoint."""
    return {
        "total_requests": metrics.total_requests,
        "total_errors": metrics.total_errors,
        "error_rate": round(metrics.total_errors / max(metrics.total_requests, 1), 4),
        "avg_latency_ms": round(metrics.avg_latency_ms, 1),
        "p95_latency_ms": round(metrics.p95_latency_ms, 1),
        "carts_built": metrics.carts_built,
        "cache_hits": metrics.cache_hits,
        "cache_misses": metrics.cache_misses,
        "llm_calls": metrics.llm_calls,
        "avg_llm_latency_ms": round(metrics.avg_llm_latency_ms, 1),
        "top_paths": dict(
            sorted(metrics.requests_by_path.items(), key=lambda x: x[1], reverse=True)[:10]
        ),
        "status_codes": dict(metrics.requests_by_status),
        "uptime_requests": metrics.total_requests,
    }
