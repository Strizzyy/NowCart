"""Vision controller — photo/image analysis to cart.

Routes:
    POST /api/vision/analyze  -> CartResponse
"""
from fastapi import APIRouter, UploadFile, File

from app.models.domain.enums import IntentMode
from app.models.dto.responses import CartResponse
from app.services.outcome_service import get_outcome_service

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/analyze", response_model=CartResponse)
async def analyze_image(
    file: UploadFile | None = File(default=None),
    text: str | None = None,
) -> CartResponse:
    """Analyze an uploaded image (or placeholder text) and build a cart.

    For now routes through the outcome engine with mode=PHOTO.
    The mock provider returns deterministic results regardless of input.
    """
    service = get_outcome_service()
    input_text = text or "photo analysis"
    cart = await service.process_outcome(
        text=input_text,
        mode=IntentMode.PHOTO,
    )
    return CartResponse.from_domain(cart)
