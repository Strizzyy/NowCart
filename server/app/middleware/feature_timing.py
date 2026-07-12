"""Feature usage timing — logs each door's start-to-end wall-clock time.

Every one of NowCart's five doors (Show, Share, Speak, Constrain/Budget,
Subscribe) plus the underlying Outcome engine gets one JSON line per call in
logs/feature_usage.jsonl, covering the full span from the request landing to
the final response leaving — i.e. real user-perceived latency, not just the
LLM call inside it.

Run the app locally, click through the doors, then hand the resulting
logs/feature_usage.jsonl back for aggregation — that's the whole workflow.
Not committed: see .gitignore.
"""
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

# path prefix -> feature name. Order matters: first match wins.
_FEATURE_PREFIXES: list[tuple[str, str]] = [
    ("/api/vision/analyze", "show"),
    ("/api/share/parse", "share"),
    ("/api/voice/intent", "speak"),
    ("/api/constraint", "constrain"),
    ("/api/outcome", "outcome"),
    ("/api/cart/op", "cart_edit"),
    ("/api/orders/place", "checkout"),
    ("/api/replan", "subscribe"),
    ("/api/counterfactuals", "subscribe"),
    ("/api/subscribe", "subscribe"),
    ("/api/preferences", "subscribe"),
    ("/api/pantry", "subscribe"),
]


def _resolve_feature(path: str) -> str | None:
    for prefix, name in _FEATURE_PREFIXES:
        if path.startswith(prefix):
            return name
    return None


def _build_usage_logger() -> logging.Logger:
    log_path = Path(settings.feature_log_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    usage_logger = logging.getLogger("nowcart.feature_usage")
    usage_logger.setLevel(logging.INFO)
    usage_logger.propagate = False  # keep these lines out of the console/root log
    if not usage_logger.handlers:
        handler = logging.FileHandler(log_path, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(message)s"))
        usage_logger.addHandler(handler)
    return usage_logger


_usage_logger = _build_usage_logger()


class FeatureTimingMiddleware(BaseHTTPMiddleware):
    """Log one JSON line per feature-door call: start time, end time, duration."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        feature = _resolve_feature(request.url.path)
        if feature is None:
            return await call_next(request)

        started_at = datetime.now(timezone.utc)
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1000.0
            _usage_logger.info(json.dumps({
                "feature": feature,
                "method": request.method,
                "path": request.url.path,
                "status": status_code,
                "ok": status_code < 400,
                "duration_ms": round(duration_ms, 1),
                "started_at": started_at.isoformat(),
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "request_id": getattr(request.state, "request_id", None),
            }))
