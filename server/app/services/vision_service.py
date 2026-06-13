"""Vision service — image analysis to cart (B2 "Show It").

Uses the VisionProvider (Gemini) to analyze food/dish images, extract
ingredients, then routes through the Outcome Engine for catalog matching.
Falls back gracefully if vision is unavailable.
"""
from __future__ import annotations

import logging

from app.llm.factory import get_vision_provider, get_text_provider
from app.models.domain.cart import Cart
from app.models.domain.enums import IntentMode
from app.services.outcome_service import get_outcome_service

logger = logging.getLogger(__name__)


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

        # Call vision provider
        vision_result = await vision.describe_image(image_bytes, prompt)

        # Check if vision degraded
        if vision_result.get("degraded", False):
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

        # Extract info from vision result
        dish = vision_result.get("dish", "unknown dish")
        ingredients = vision_result.get("ingredients", [])
        servings = vision_result.get("servings_estimate", 2)
        cuisine = vision_result.get("cuisine", "")

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
