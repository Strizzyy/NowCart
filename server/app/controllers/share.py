"""Share controller — recipe link/text parsing to cart (B4).

Routes:
    POST /api/share/parse  -> CartResponse

Parses YouTube videos, recipe blogs, Instagram reels, or pasted recipe text
into a grocery cart using LLM-powered extraction + the Outcome Engine.
"""
from fastapi import APIRouter

from app.models.dto.requests import ShareRequest
from app.models.dto.responses import CartResponse
from app.services.share_service import get_share_service

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("/parse", response_model=CartResponse)
async def parse_share(req: ShareRequest) -> CartResponse:
    """Parse a shared recipe link or text and build a cart.

    Supports:
    - YouTube video URLs (extracts recipe from title/description)
    - Recipe blog URLs (extracts ingredients from page content)
    - Instagram reel URLs
    - Pasted recipe text / ingredient lists
    """
    service = get_share_service()
    cart = await service.parse_shared_content(
        url=req.url,
        text=req.text,
        session_id=req.session_id,
    )
    return CartResponse.from_domain(cart)
