"""Controllers (HTTP routes only — thin; logic lives in services).

`api_router` aggregates every feature router. As feature controllers land
(outcome, voice, constraint, vision, share, cart, sos, catalog, admin) they
register here, keeping `main.py` stable.
"""
from fastapi import APIRouter

from app.controllers import health

api_router = APIRouter()
api_router.include_router(health.router)

# Feature routers are mounted under /api as they are implemented:
# api_router.include_router(outcome.router, prefix="/api")
# api_router.include_router(voice.router, prefix="/api")
# ...

__all__ = ["api_router"]
