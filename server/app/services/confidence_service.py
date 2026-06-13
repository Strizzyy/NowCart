"""Confidence service — per-item and overall cart confidence scoring (C2/C3).

Provides standalone confidence scoring that can be used outside the graph pipeline,
e.g. for re-scoring after manual cart edits or for the frontend confidence chips.
"""
from __future__ import annotations

from app.core.config import settings
from app.models.domain.cart import Cart


class ConfidenceService:
    """Score cart items and overall cart confidence."""

    def __init__(self, threshold: float | None = None) -> None:
        self.threshold = threshold or settings.confidence_threshold

    def score_cart(self, cart: Cart) -> float:
        """Compute and set overall cart confidence from item confidences.

        Returns:
            Overall confidence score (0.0–1.0).
        """
        if not cart.items:
            cart.confidence = 0.0
            return 0.0

        total = sum(item.confidence for item in cart.items)
        overall = total / len(cart.items)
        cart.confidence = round(overall, 3)
        return cart.confidence

    def needs_clarification(self, cart: Cart) -> str | None:
        """Check if the cart needs HITL clarification based on confidence.

        Returns:
            A clarification question string if confidence is below threshold,
            otherwise None.
        """
        if not cart.items:
            return "Could not build a cart from your request. Could you be more specific?"

        overall = cart.confidence
        if overall >= self.threshold:
            return None

        low_items = [item.name for item in cart.items if item.confidence < self.threshold]
        if low_items:
            items_str = ", ".join(low_items[:3])
            return (
                f"I'm not fully confident about: {items_str}. "
                "Would you like me to show alternatives, or should I proceed with these picks?"
            )
        return "The overall match confidence is low. Would you like me to refine the selections?"

    def get_low_confidence_items(self, cart: Cart) -> list[dict]:
        """Return items below the confidence threshold with their scores.

        Returns:
            List of dicts with product_id, name, confidence for low-confidence items.
        """
        return [
            {"product_id": item.product_id, "name": item.name, "confidence": item.confidence}
            for item in cart.items
            if item.confidence < self.threshold
        ]


_confidence_service: ConfidenceService | None = None


def get_confidence_service() -> ConfidenceService:
    """Return the singleton ConfidenceService."""
    global _confidence_service
    if _confidence_service is None:
        _confidence_service = ConfidenceService()
    return _confidence_service
