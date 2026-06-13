"""Meta router: API info root and a placeholder for future API routes.

Thin by design — additional routers (outcome, voice, cart, etc.) are added
under the `/api` prefix in task 6. This keeps the app booting cleanly today.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/", tags=["meta"])
async def api_root() -> dict:
    """Basic API info served at the `/api` root."""
    return {
        "name": "NowCart API",
        "description": "Intent-capture layer on top of quick-commerce.",
        "docs": "/docs",
        "health": "/health",
    }
