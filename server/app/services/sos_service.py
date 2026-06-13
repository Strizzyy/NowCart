"""SOS / Emergency service (D4) — quick emergency kit builder.

When users say "guests in 30 minutes" or "fever emergency", this service
returns a pre-built kit of essential products without the full decompose flow.
"""
from __future__ import annotations

import uuid

from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.services.catalog_service import get_catalog_service


# Pre-defined emergency kits — deterministic for demo repeatability
_SOS_KITS: dict[str, list[dict]] = {
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
    "default": [
        {"name": "bread", "quantity": 1, "category_hint": "bakery"},
        {"name": "milk", "quantity": 2, "category_hint": "dairy"},
        {"name": "eggs", "quantity": 6, "category_hint": "eggs"},
        {"name": "rice", "quantity": 1, "category_hint": "rice"},
        {"name": "water", "quantity": 4, "category_hint": "beverages"},
    ],
}


class SosService:
    """Build an emergency kit cart from a situation description."""

    async def build_sos_cart(self, situation: str) -> Cart:
        """Build an emergency kit based on the situation.

        Args:
            situation: Description like "guests in 30 minutes" or "fever".

        Returns:
            A Cart with emergency items, mode=SOS.
        """
        catalog = get_catalog_service()
        situation_lower = situation.lower()

        # Pick the right kit
        kit_key = "default"
        for key in _SOS_KITS:
            if key in situation_lower:
                kit_key = key
                break

        kit = _SOS_KITS[kit_key]
        items: list[CartItem] = []

        for need in kit:
            matches = await catalog.fuzzy_match_need(
                need_name=need["name"],
                category_hint=need.get("category_hint"),
                top_k=3,
            )

            # Pick first available match
            for product, score in matches:
                if await catalog.check_availability(product.product_id):
                    items.append(
                        CartItem(
                            product_id=product.product_id,
                            name=product.name,
                            price=product.sale_price,
                            quantity=need["quantity"],
                            unit="unit",
                            reason=f"SOS kit: {kit_key}",
                            confidence=min(score / 100.0, 1.0),
                        )
                    )
                    break

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            mode=IntentMode.SOS,
            notes=[f"Emergency kit: {kit_key} ({situation})"],
        )
        cart.recompute_total()
        return cart


_sos_service: SosService | None = None


def get_sos_service() -> SosService:
    """Return the singleton SosService."""
    global _sos_service
    if _sos_service is None:
        _sos_service = SosService()
    return _sos_service
