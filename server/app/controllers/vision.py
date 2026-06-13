"""Vision controller — photo/image analysis to cart (B2 "Show It").

Routes:
    POST /api/vision/analyze  -> CartResponse

Uses Gemini Vision to identify dishes from photos and build a cart
with all the ingredients needed to recreate the dish at home.
"""
from fastapi import APIRouter, UploadFile, File, Form

from app.models.dto.responses import CartResponse
from app.services.vision_service import get_vision_service

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/analyze", response_model=CartResponse)
async def analyze_image(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
) -> CartResponse:
    """Analyze an uploaded food/dish image and build a cart to recreate it.

    Upload a photo of a dish and get a complete grocery cart with all
    ingredients needed. Uses multimodal AI (Gemini Vision) for image
    understanding.

    Args:
        file: Image file (JPEG/PNG) of a dish.
        text: Optional text hint (e.g. "this is a north Indian dish").
        session_id: Optional session ID for cart continuity.
    """
    service = get_vision_service()

    image_bytes = b""
    if file:
        image_bytes = await file.read()

    cart = await service.analyze_image(
        image_bytes=image_bytes,
        text_hint=text,
        session_id=session_id,
    )
    return CartResponse.from_domain(cart)
