"""Outcome controller — A1 text-to-cart front door.

Routes:
    POST /api/outcome  -> CartResponse
"""
from fastapi import APIRouter

from app.models.dto.requests import OutcomeRequest
from app.models.dto.responses import CartResponse
from app.services.outcome_service import get_outcome_service

router = APIRouter(prefix="/api", tags=["outcome"])


@router.post("/outcome", response_model=CartResponse)
async def create_outcome(req: OutcomeRequest) -> CartResponse:
    """Process a natural-language outcome into a grocery cart.

    Now supports user_id for personalized matching:
    - Preference-boosted confidence scores
    - Pantry-aware need filtering
    - Personalized "why this one" explanations
    """
    service = get_outcome_service()
    cart = await service.process_outcome(
        text=req.text,
        servings=req.servings,
        user_id=req.user_id,
    )
    return CartResponse.from_domain(cart)
