"""SOS / Emergency service (D4) — AI-powered emergency kit builder.

When users say "guests in 30 minutes" or "fever emergency", this service
uses the LLM to intelligently determine what items are needed, then matches
against the catalog for fastest assembly.

Falls back to pre-defined kits if the LLM is unavailable (graceful degradation).
"""
from __future__ import annotations

import logging
import uuid

from app.llm.factory import get_text_provider
from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.services.catalog_service import get_catalog_service

logger = logging.getLogger(__name__)


# Pre-defined emergency kits — fallback when LLM is unavailable
_FALLBACK_KITS: dict[str, list[dict]] = {
    "guests": [
        {"name": "tea", "quantity": 1, "category_hint": "tea"},
        {"name": "biscuits", "quantity": 2, "category_hint": "snacks"},
        {"name": "chips", "quantity": 2, "category_hint": "snacks"},
        {"name": "cold drink", "quantity": 3, "category_hint": "beverages"},
        {"name": "namkeen", "quantity": 2, "category_hint": "snacks"},
        {"name": "cake", "quantity": 1, "category_hint": "bakery"},
    ],
    "fever": [
        {"name": "orange juice", "quantity": 2, "category_hint": "beverages"},
        {"name": "soup", "quantity": 2, "category_hint": "ready to eat"},
        {"name": "honey", "quantity": 1, "category_hint": "spreads"},
        {"name": "bread", "quantity": 1, "category_hint": "bakery"},
        {"name": "banana", "quantity": 6, "category_hint": "fruits"},
    ],
    "baby": [
        {"name": "diapers", "quantity": 1, "category_hint": "baby care"},
        {"name": "baby wipes", "quantity": 1, "category_hint": "baby care"},
        {"name": "baby food", "quantity": 2, "category_hint": "baby care"},
        {"name": "milk", "quantity": 2, "category_hint": "dairy"},
    ],
    "default": [
        {"name": "bread", "quantity": 1, "category_hint": "bakery"},
        {"name": "milk", "quantity": 2, "category_hint": "dairy"},
        {"name": "eggs", "quantity": 6, "category_hint": "eggs"},
        {"name": "rice", "quantity": 1, "category_hint": "rice"},
        {"name": "water", "quantity": 4, "category_hint": "beverages"},
    ],
}


class SosService:
    """Build an emergency kit cart from a situation description using AI."""

    async def build_sos_cart(self, situation: str) -> Cart:
        """Build an emergency kit based on the situation using AI.

        Strategy:
        1. Use Groq LLM to analyze the emergency situation and recommend items
        2. Match recommended items against the catalog (in-stock only)
        3. If LLM fails, fall back to pre-defined kits

        Args:
            situation: Description like "guests in 30 minutes" or "child has fever".

        Returns:
            A Cart with emergency items, mode=SOS, with ETA.
        """
        catalog = get_catalog_service()
        llm = get_text_provider()

        # Try AI-powered kit building
        kit_items = await self._get_ai_kit(llm, situation)

        if not kit_items:
            # Fallback to predefined kits
            kit_items = self._get_fallback_kit(situation)

        items: list[CartItem] = []
        etas: list[int] = []

        for need in kit_items:
            matches = await catalog.fuzzy_match_need(
                need_name=need["name"],
                category_hint=need.get("category_hint"),
                top_k=3,
            )

            # Pick first available match (in-stock only for SOS urgency)
            for product, score in matches:
                if await catalog.check_availability(product.product_id):
                    items.append(
                        CartItem(
                            product_id=product.product_id,
                            name=product.name,
                            price=product.sale_price,
                            quantity=need["quantity"],
                            unit="unit",
                            reason=need.get("reason", f"SOS: {situation}"),
                            confidence=min(score / 100.0, 1.0),
                        )
                    )
                    etas.append(getattr(product, "delivery_eta_min", 30) or 30)
                    break

        # SOS ETA = the slowest item in the kit (when everything arrives)
        eta_minutes = max(etas) if etas else 30

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            mode=IntentMode.SOS,
            eta_minutes=eta_minutes,
            notes=[f"Emergency kit for: {situation}"],
        )
        cart.recompute_total()

        # Compute confidence
        if cart.items:
            avg_conf = sum(i.confidence for i in cart.items) / len(cart.items)
            cart.confidence = round(avg_conf, 3)

        return cart

    async def _get_ai_kit(self, llm, situation: str) -> list[dict]:
        """Use the LLM to determine emergency kit items."""
        system_prompt = (
            "You are an emergency grocery assistant for a quick-commerce app in India. "
            "Given an urgent situation, recommend the ESSENTIAL grocery/household items "
            "needed immediately. Focus on practicality and speed.\n\n"
            "Rules:\n"
            "- Keep it to 5-8 items maximum (this is emergency, not a full shop)\n"
            "- Prioritize items that solve the immediate need\n"
            "- Think about what's actually available in a grocery store\n"
            "- Include a brief reason for each item\n\n"
            "Return JSON: {\"kit_name\": \"short name\", \"items\": ["
            "{\"name\": \"product name\", \"quantity\": number, "
            "\"category_hint\": \"category\", \"reason\": \"why this item\"}]}"
        )

        schema_hint = (
            '{"kit_name": "string", "items": [{"name": "str", "quantity": "number", '
            '"category_hint": "str", "reason": "str"}]}'
        )

        try:
            result = await llm.complete_json(system_prompt, situation, schema_hint)
            items = result.get("items", [])
            if items and len(items) > 0:
                logger.info("AI SOS kit: %s (%d items)", result.get("kit_name", ""), len(items))
                return items
        except Exception as exc:
            logger.warning("AI SOS kit generation failed: %s", exc)

        return []

    def _get_fallback_kit(self, situation: str) -> list[dict]:
        """Fall back to predefined kits based on keyword matching."""
        situation_lower = situation.lower()
        kit_key = "default"
        for key in _FALLBACK_KITS:
            if key in situation_lower:
                kit_key = key
                break
        return _FALLBACK_KITS[kit_key]


_sos_service: SosService | None = None


def get_sos_service() -> SosService:
    """Return the singleton SosService."""
    global _sos_service
    if _sos_service is None:
        _sos_service = SosService()
    return _sos_service
