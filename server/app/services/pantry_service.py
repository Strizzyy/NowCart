"""Pantry Service — recently-ordered prompt for cart items.

Replaces the old shelf-life-based pantry filter.
Now only answers: "has the user ordered this product in the last 30 days?"

Usage (in outcome_service.py, post-assembly):
    service = get_pantry_service()
    recently = await service.get_recently_ordered(user_id, [item.product_id for item in cart.items])
    for item in cart.items:
        if item.product_id in recently:
            item.recently_ordered = True
            item.days_ago = recently[item.product_id]

Frontend shows: "You ordered this 5 days ago — still need it?" with a remove button.
No auto-removal — item stays in cart by default.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime

from app.repositories import get_repository

logger = logging.getLogger(__name__)


class PantryService:
    """Checks recent order history for cart items."""

    async def get_recently_ordered(
        self,
        user_id: str,
        product_ids: list[str],
        within_days: int = 30,
    ) -> dict[str, int]:
        """Return {product_id: days_since_last_order} for products ordered within `within_days`.

        Only products that appear in `product_ids` are checked.
        Products not ordered within the window are excluded from the result.

        Args:
            user_id: The user to look up.
            product_ids: List of product IDs to check (from the assembled cart).
            within_days: Lookback window in days (default 30).

        Returns:
            Dict mapping product_id → days since last order, for recently ordered items.
        """
        if not user_id or not product_ids:
            return {}

        repo = get_repository()
        orders = await repo.get_orders(user_id)

        if not orders:
            return {}

        product_id_set = set(product_ids)
        now = datetime.now()
        # Track most recent order date per product
        last_ordered: dict[str, datetime] = {}

        for order in orders:
            try:
                order_date = datetime.fromisoformat(order.order_date)
            except (ValueError, TypeError):
                continue

            days_since = (now - order_date).days
            if days_since > within_days:
                continue  # outside window

            for item in order.items:
                pid = item.get("product_id", "")
                if pid not in product_id_set:
                    continue
                # Keep the most recent order date
                if pid not in last_ordered or order_date > last_ordered[pid]:
                    last_ordered[pid] = order_date

        result: dict[str, int] = {}
        for pid, last_date in last_ordered.items():
            days_ago = max(0, (now - last_date).days)
            result[pid] = days_ago

        return result


_pantry_service: PantryService | None = None


def get_pantry_service() -> PantryService:
    """Return the singleton PantryService."""
    global _pantry_service
    if _pantry_service is None:
        _pantry_service = PantryService()
    return _pantry_service
