"""Share controller — recipe link/text parsing to cart.

Routes:
    POST /api/share/parse  -> CartResponse
"""
from fastapi import APIRouter

from app.models.domain.enums import IntentMode
from app.models.dto.requests import ShareRequest
from app.models.dto.responses import CartResponse
from app.services.outcome_service import get_outcome_service

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("/parse", response_model=CartResponse)
async def parse_share(req: ShareRequest) -> CartResponse:
    """Parse a shared recipe link or text and build a cart."""
    service = get_outcome_service()
    input_text = req.text or req.url or "shared recipe"
    cart = await service.process_outcome(
        text=input_text,
        mode=IntentMode.LINK,
    )
    return CartResponse.from_domain(cart)
