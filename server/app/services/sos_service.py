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
        {"name": "ORS powder", "quantity": 3, "category_hint": "health & hygiene"},
        {"name": "coconut water", "quantity": 3, "category_hint": "beverages"},
        {"name": "banana", "quantity": 6, "category_hint": "fruits"},
        {"name": "soup", "quantity": 2, "category_hint": "ready to eat"},
        {"name": "apple juice", "quantity": 2, "category_hint": "beverages"},
        {"name": "bread", "quantity": 1, "category_hint": "bakery"},
        {"name": "curd", "quantity": 1, "category_hint": "dairy"},
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
        4. For each item, also find a cheaper alternative for the economical section

        Args:
            situation: Description like "guests in 30 minutes" or "child has fever".

        Returns:
            A Cart with emergency items + economical alternatives, mode=SOS, with ETA.
        """
        catalog = get_catalog_service()
        llm = get_text_provider()

        # Try AI-powered kit building
        kit_items = await self._get_ai_kit(llm, situation)

        if not kit_items:
            # Fallback to predefined kits
            kit_items = self._get_fallback_kit(situation)

        items: list[CartItem] = []
        economical_items: list[CartItem] = []
        etas: list[int] = []

        for need in kit_items:
            matches = await catalog.fuzzy_match_need(
                need_name=need["name"],
                category_hint=need.get("category_hint"),
                top_k=5,
            )

            # Collect all available candidates
            available: list[tuple] = []
            for product, score in matches:
                if await catalog.check_availability(product.product_id):
                    available.append((product, score))

            if not available:
                continue

            # Best = first available (highest score)
            best_product, best_score = available[0]
            items.append(
                CartItem(
                    product_id=best_product.product_id,
                    name=best_product.name,
                    price=best_product.sale_price,
                    quantity=need["quantity"],
                    unit="unit",
                    reason=need.get("reason", f"SOS: {situation}"),
                    confidence=min(best_score / 100.0, 1.0),
                    image_url=best_product.image_url,
                )
            )
            etas.append(getattr(best_product, "delivery_eta_min", 30) or 30)

            # Find cheapest alternative for economical section
            sorted_by_price = sorted(available, key=lambda x: x[0].sale_price)
            cheapest = sorted_by_price[0]

            # If cheapest is the same as best, try next
            if cheapest[0].product_id == best_product.product_id and len(sorted_by_price) > 1:
                cheapest = sorted_by_price[1]

            if cheapest[0].product_id != best_product.product_id:
                eco_product, eco_score = cheapest
                saving = round(best_product.sale_price - eco_product.sale_price, 2)
                reason = f"Budget-friendly pick (saves ₹{saving:.0f})" if saving > 0 else "Economical alternative"
                economical_items.append(
                    CartItem(
                        product_id=eco_product.product_id,
                        name=eco_product.name,
                        price=eco_product.sale_price,
                        quantity=need["quantity"],
                        unit="unit",
                        reason=reason,
                        confidence=min(eco_score / 100.0, 1.0),
                        image_url=eco_product.image_url,
                    )
                )
            else:
                # No cheaper alternative — mirror the same item
                economical_items.append(
                    CartItem(
                        product_id=best_product.product_id,
                        name=best_product.name,
                        price=best_product.sale_price,
                        quantity=need["quantity"],
                        unit="unit",
                        reason="Same as recommended (no cheaper option)",
                        confidence=min(best_score / 100.0, 1.0),
                        image_url=best_product.image_url,
                    )
                )

        # SOS ETA = the slowest item in the kit (when everything arrives)
        eta_minutes = max(etas) if etas else 30

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            economical_items=economical_items,
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
            "needed immediately. You must think like a practical, caring parent or adult "
            "who knows what actually helps in real emergencies.\n\n"
            "Rules:\n"
            "- Keep it to 5-8 items maximum (this is emergency, not a full shop)\n"
            "- Prioritize items that DIRECTLY solve the immediate need\n"
            "- Think about what's actually available in a grocery/quick-commerce store\n"
            "- Be PRACTICAL and EVIDENCE-BASED. Do NOT recommend home remedies, "
            "unproven treatments, or items that are irrelevant to the situation.\n"
            "- For health emergencies (fever, cold, stomach issues, etc.):\n"
            "  * Recommend hydration (ORS, electrolyte drinks, coconut water, clear fluids)\n"
            "  * Recommend easily digestible food (bananas, rice, toast, soup, khichdi mix)\n"
            "  * Recommend comfort items (tissues, thermometer if available)\n"
            "  * Do NOT recommend vinegar, honey for children under 1 year, or unproven remedies\n"
            "  * Think: what would a pediatrician/doctor suggest as supportive care?\n"
            "- For social emergencies (guests, party): focus on snacks, beverages, quick meals\n"
            "- For baby emergencies: focus on diapers, wipes, formula, baby food\n"
            "- Include a brief, practical reason for each item\n\n"
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


    async def recommend_sos_products(self, situation: str) -> list[dict]:
        """Analyze an emergency situation and return product recommendations
        with full details, without adding anything to cart.

        Returns a list of dicts, each with:
          - product: full product details (id, name, brand, image, rating, price, etc.)
          - reason: why this product is recommended for this situation
          - quantity: suggested quantity
        """
        catalog = get_catalog_service()
        llm = get_text_provider()

        # Try AI-powered kit building
        kit_items = await self._get_ai_kit(llm, situation)

        if not kit_items:
            kit_items = self._get_fallback_kit(situation)

        recommendations: list[dict] = []

        for need in kit_items:
            matches = await catalog.fuzzy_match_need(
                need_name=need["name"],
                category_hint=need.get("category_hint"),
                top_k=3,
            )

            # Pick first available match (in-stock only for SOS urgency)
            for product, score in matches:
                if await catalog.check_availability(product.product_id):
                    recommendations.append({
                        "product": product.model_dump(),
                        "reason": need.get("reason", f"Recommended for: {situation}"),
                        "quantity": need["quantity"],
                        "confidence": min(score / 100.0, 1.0),
                    })
                    break

        return recommendations


_sos_service: SosService | None = None


def get_sos_service() -> SosService:
    """Return the singleton SosService."""
    global _sos_service
    if _sos_service is None:
        _sos_service = SosService()
    return _sos_service
