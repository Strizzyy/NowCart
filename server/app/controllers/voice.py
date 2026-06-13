"""Voice intent controller — A2 speech transcript to cart.

Routes:
    POST /api/voice/intent  -> CartResponse
"""
from fastapi import APIRouter

from app.models.domain.enums import IntentMode
from app.models.dto.requests import VoiceIntentRequest
from app.models.dto.responses import CartResponse
from app.services.outcome_service import get_outcome_service

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/intent", response_model=CartResponse)
async def voice_intent(req: VoiceIntentRequest) -> CartResponse:
    """Route a voice transcript through the outcome engine (mode=TEXT)."""
    service = get_outcome_service()
    cart = await service.process_outcome(
        text=req.transcript,
        mode=IntentMode.TEXT,
    )
    return CartResponse.from_domain(cart)
