"""Vision service — image analysis to cart (B2 "Show It").

Uses the VisionProvider (Gemini) to analyze food/dish images, extract
ingredients, then routes through the Outcome Engine for catalog matching.
Falls back gracefully if vision is unavailable.
"""
from __future__ import annotations

import io
import logging

from PIL import Image

from app.llm.factory import get_vision_provider, get_text_provider
from app.llm.schemas import VisionResult
from app.models.domain.cart import Cart
from app.models.domain.enums import IntentMode
from app.services.outcome_service import get_outcome_service

logger = logging.getLogger(__name__)

# Full-resolution phone photos (often 3-8MB) sent as-is to Gemini are the
# dominant cost in the ~20s "Show" latency — food identification doesn't need
# more than this long edge, so downscaling first cuts upload + inference time
# with no meaningful accuracy loss.
_MAX_VISION_DIMENSION = 1280
_VISION_JPEG_QUALITY = 85


def _resize_for_vision(image_bytes: bytes) -> bytes:
    """Downscale + re-encode an image before sending it to the vision model.

    Falls back to the original bytes on any decode failure (unsupported
    format, corrupt upload) so a resize problem never breaks the request.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            if img.width <= _MAX_VISION_DIMENSION and img.height <= _MAX_VISION_DIMENSION:
                return image_bytes
            img = img.convert("RGB")
            img.thumbnail((_MAX_VISION_DIMENSION, _MAX_VISION_DIMENSION), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=_VISION_JPEG_QUALITY)
            resized = buf.getvalue()
            logger.info(
                "Resized vision upload: %d bytes -> %d bytes (%dx%d)",
                len(image_bytes), len(resized), img.width, img.height,
            )
            return resized
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vision image resize failed, sending original bytes: %s", exc)
        return image_bytes


class VisionService:
    """Analyze food images and build a grocery cart to recreate the dish."""

    async def analyze_image(
        self,
        image_bytes: bytes,
        text_hint: str | None = None,
        session_id: str | None = None,
    ) -> Cart:
        """Analyze an uploaded food/dish image and build a cart.

        Strategy:
        1. Use VisionProvider (Gemini) to identify the dish and ingredients
        2. If vision returns a dish/ingredients, build a text outcome from it
        3. Route through the Outcome Engine for catalog matching + cart assembly

        Args:
            image_bytes: Raw image data (JPEG/PNG).
            text_hint: Optional text context from the user (e.g. "this is a biryani").
            session_id: Optional existing session ID.

        Returns:
            Cart with matched products from the identified recipe.
        """
        vision = get_vision_provider()

        # Build a vision prompt
        prompt = (
            "You are a food/dish identification expert. Analyze this image and identify:\n"
            "1. The dish name\n"
            "2. All visible ingredients and likely ingredients needed to make this dish\n\n"
            "Return JSON: {\"dish\": \"dish name\", \"ingredients\": [\"ingredient1\", \"ingredient2\", ...], "
            "\"servings_estimate\": number, \"cuisine\": \"cuisine type\"}\n\n"
            "Be specific about ingredients — include quantities where you can estimate them."
        )

        if text_hint:
            prompt += f"\n\nUser context: {text_hint}"

        # Call vision provider — resize first, the biggest lever on end-to-end latency
        resized_bytes = _resize_for_vision(image_bytes)
        raw_vision_result = await vision.describe_image(resized_bytes, prompt)
        vision_result = VisionResult.model_validate(raw_vision_result)

        if vision_result.degraded:
            logger.warning("Vision provider degraded — falling back to text hint")
            # Fall back to text hint or generic
            fallback_text = text_hint or "identify dish from photo"
            outcome_service = get_outcome_service()
            cart = await outcome_service.process_outcome(
                text=fallback_text,
                mode=IntentMode.PHOTO,
            )
            cart.degraded = True
            cart.notes.append("Vision analysis unavailable — used text fallback")
            if session_id:
                cart.session_id = session_id
            return cart

        dish = vision_result.dish
        ingredients = vision_result.ingredients
        servings = vision_result.servings_estimate
        cuisine = vision_result.cuisine

        # Build a natural-language outcome from the vision analysis
        if ingredients:
            ingredient_str = ", ".join(ingredients)
            outcome_text = f"Making {dish} ({cuisine}): I need {ingredient_str}"
        else:
            outcome_text = f"Making {dish}"

        # Route through outcome engine
        outcome_service = get_outcome_service()
        cart = await outcome_service.process_outcome(
            text=outcome_text,
            servings=servings if servings and servings > 1 else None,
            mode=IntentMode.PHOTO,
        )

        # Add vision context to reasoning trail
        cart.reasoning_trail.insert(0, f"Vision identified: {dish} ({cuisine})")
        if ingredients:
            cart.reasoning_trail.insert(1, f"Detected ingredients: {', '.join(ingredients[:8])}")

        if session_id:
            cart.session_id = session_id

        return cart


_vision_service: VisionService | None = None


def get_vision_service() -> VisionService:
    """Return the singleton VisionService."""
    global _vision_service
    if _vision_service is None:
        _vision_service = VisionService()
    return _vision_service
