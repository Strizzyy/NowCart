"""Pantry Service — tracks what users already have at home.

Enables pantry-aware decomposition: "Biryani for 4, but I already have rice"
→ the engine subtracts rice from the cart.

The pantry model is seeded from order history + predicted depletion:
- Items purchased recently (within their depletion window) are "in pantry"
- Items past their depletion window are "likely consumed"
- Users can explicitly mark items as "have" or "need"

This integrates as a filter node in the LangGraph DAG between
decompose and match — subtracting pantry items from the needs list.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain.order import Order
from app.repositories import get_repository, get_cache

logger = logging.getLogger(__name__)


class PantryItem(BaseModel):
    """An item likely in the user's pantry."""

    product_id: str
    product_name: str
    category: str = ""
    estimated_remaining_days: float = 0.0
    confidence: float = 0.5  # how sure we are they still have it
    source: str = "inferred"  # "inferred" from orders or "explicit" from user


class PantryService:
    """Manages the user's inferred pantry state."""

    # Average shelf life / consumption time for common categories (days)
    _CATEGORY_SHELF_LIFE: dict[str, float] = {
        "rice": 60,
        "foodgrains oil masala": 45,
        "dals pulses": 40,
        "edible oils ghee": 60,
        "spices": 90,
        "masala": 60,
        "fruits vegetables": 5,
        "fresh vegetables": 4,
        "fresh fruits": 5,
        "eggs meat fish": 3,
        "bakery cakes dairy": 5,
        "dairy cheese": 7,
        "beverages": 14,
        "snacks branded foods": 21,
        "gourmet world food": 30,
    }

    async def get_pantry(self, user_id: str) -> list[PantryItem]:
        """Get the inferred pantry for a user.

        Returns items the user likely still has at home based on:
        1. Recent purchases within shelf life / consumption window
        2. Explicit user markings (stored in cache)

        Returns:
            List of PantryItem objects.
        """
        # Check cache first
        cache = get_cache()
        cached = await cache._get(f"pantry:{user_id}")
        if cached:
            try:
                import json
                items_raw = json.loads(cached)
                return [PantryItem(**item) for item in items_raw]
            except Exception:
                pass

        # Compute from order history
        pantry = await self._infer_pantry(user_id)

        # Cache for 30 minutes
        try:
            import json
            await cache._set(
                f"pantry:{user_id}",
                json.dumps([item.model_dump() for item in pantry]),
                ttl=1800,
            )
        except Exception:
            pass

        return pantry

    async def _infer_pantry(self, user_id: str) -> list[PantryItem]:
        """Infer pantry contents from recent orders."""
        repo = get_repository()
        orders = await repo.get_orders(user_id)

        if not orders:
            return []

        now = datetime.now()
        pantry_items: list[PantryItem] = []
        seen_products: set[str] = set()

        for order in orders[:5]:  # Look at last 5 orders
            try:
                order_date = datetime.fromisoformat(order.order_date)
            except (ValueError, TypeError):
                continue

            days_since = (now - order_date).days

            for item in order.items:
                pid = item.get("product_id", "")
                if not pid or pid in seen_products:
                    continue

                # Get product details for category-based shelf life
                product = await repo.get_product(pid)
                if not product:
                    continue

                # Determine expected shelf life
                category_lower = product.category.lower()
                shelf_life = self._CATEGORY_SHELF_LIFE.get(category_lower, 14)

                # Also check sub_category
                for cat_key, life in self._CATEGORY_SHELF_LIFE.items():
                    if cat_key in product.sub_category.lower():
                        shelf_life = life
                        break

                # Estimate remaining days
                remaining = shelf_life - days_since

                if remaining > 0:
                    # Item is likely still in pantry
                    # Confidence decreases as we approach shelf life end
                    conf = min(0.9, max(0.2, remaining / shelf_life))

                    pantry_items.append(PantryItem(
                        product_id=pid,
                        product_name=product.name,
                        category=product.category,
                        estimated_remaining_days=round(remaining, 1),
                        confidence=round(conf, 2),
                        source="inferred",
                    ))
                    seen_products.add(pid)

        # Sort by confidence
        pantry_items.sort(key=lambda x: -x.confidence)
        return pantry_items[:30]  # Cap at 30 items

    def filter_needs_by_pantry(
        self,
        need_names: list[str],
        pantry: list[PantryItem],
        threshold: float = 0.5,
    ) -> tuple[list[str], list[str]]:
        """Filter out needs the user likely already has.

        Args:
            need_names: List of ingredient/product names from decompose node.
            pantry: User's inferred pantry.
            threshold: Minimum pantry confidence to skip the item.

        Returns:
            Tuple of (needs_to_buy, already_have).
            needs_to_buy: Items to include in the cart.
            already_have: Items skipped (user has them).
        """
        # Build a lookup of pantry product names (lowercased, stemmed)
        pantry_names: set[str] = set()
        for item in pantry:
            if item.confidence >= threshold:
                # Add both full name and key words
                name_lower = item.product_name.lower()
                pantry_names.add(name_lower)
                # Add individual significant words
                for word in name_lower.split():
                    if len(word) > 3:
                        pantry_names.add(word)

        needs_to_buy: list[str] = []
        already_have: list[str] = []

        for need in need_names:
            need_lower = need.lower()
            # Check if any pantry name matches this need
            is_in_pantry = False
            for pantry_name in pantry_names:
                if (pantry_name in need_lower or need_lower in pantry_name
                        or any(w in pantry_name for w in need_lower.split() if len(w) > 3)):
                    is_in_pantry = True
                    break

            if is_in_pantry:
                already_have.append(need)
            else:
                needs_to_buy.append(need)

        return needs_to_buy, already_have


_pantry_service: PantryService | None = None


def get_pantry_service() -> PantryService:
    """Return the singleton PantryService."""
    global _pantry_service
    if _pantry_service is None:
        _pantry_service = PantryService()
    return _pantry_service
