"""Controllers (HTTP routes only — thin; logic lives in services).

`api_router` aggregates every feature router. As feature controllers land
(outcome, voice, constraint, vision, share, cart, sos, catalog, admin) they
register here, keeping `main.py` stable.
"""
from fastapi import APIRouter

from app.controllers import (
    health,
    catalog,
    outcome,
    voice,
    constraint,
    vision,
    share,
    cart,
    sos,
    admin,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(catalog.router)
api_router.include_router(outcome.router)
api_router.include_router(voice.router)
api_router.include_router(constraint.router)
api_router.include_router(vision.router)
api_router.include_router(share.router)
api_router.include_router(cart.router)
api_router.include_router(sos.router)
api_router.include_router(admin.router)

__all__ = ["api_router"]
