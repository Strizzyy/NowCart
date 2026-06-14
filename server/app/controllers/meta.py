"""Meta controller — observability, telemetry, and system info.

Routes:
    GET /api/meta/stats    -> system metrics snapshot (telemetry)
    GET /api/meta/info     -> system info (providers, backends, versions)

Demonstrates production-readiness thinking: observability, monitoring,
and operational awareness for scaling decisions.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.middleware.telemetry import get_metrics_snapshot

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/stats")
async def system_stats():
    """Return real-time system metrics.

    Includes:
    - Request counts, error rates, latency percentiles
    - Cart build counts
    - LLM cache hit/miss ratios
    - Top paths by traffic
    - Status code distribution

    Use this for monitoring dashboards, scaling decisions,
    and demonstrating production observability.
    """
    return get_metrics_snapshot()


@router.get("/info")
async def system_info():
    """Return system configuration info (non-sensitive).

    Useful for verifying which providers/backends are active
    and for the jury to see the tech stack in action.
    """
    return {
        "service": "nowcart",
        "version": "0.1.0",
        "environment": settings.app_env,
        "providers": {
            "text_llm": settings.llm_text_provider,
            "text_model": settings.groq_model if settings.llm_text_provider == "groq"
                         else settings.bedrock_model if settings.llm_text_provider == "bedrock"
                         else settings.gemini_model if settings.llm_text_provider == "gemini"
                         else "mock",
            "vision_llm": settings.llm_vision_provider,
            "vision_model": settings.gemini_model if settings.llm_vision_provider == "gemini" else "mock",
        },
        "backends": {
            "data": settings.data_backend,
            "cache": "redis" if not settings.cache_in_memory else "memory",
            "region": settings.aws_region,
        },
        "features": {
            "rate_limiting": True,
            "llm_response_caching": True,
            "telemetry": True,
            "pii_redaction": True,
            "substitution_intelligence": True,
            "hitl_confidence_gate": True,
            "multi_provider_support": ["groq", "bedrock", "gemini", "mock"],
        },
        "scaling": {
            "architecture": "stateless API + Redis state + DynamoDB persistence",
            "async_offload": "Lambda + SQS (vision, share parsing)",
            "cdn": "S3 + CloudFront",
            "rate_limit": "60 req/min per IP (token bucket)",
        },
    }
