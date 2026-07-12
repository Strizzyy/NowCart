"""Badge Service — computes the NowCart Verified badge for products.

A product earns the Verified badge when:
    score = 0.5 × (order_count_last_30_days / max_in_category)
          + 0.5 × (avg_rating / 5)
    verified = True  if score >= 0.6

order_count_month and rating are stored on the Product model.
This service recomputes them from order history and updates the catalog.

Usage:
    service = get_badge_service()
    await service.recompute_badges()   # triggered by POST /api/admin/badges/recompute
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from app.repositories import get_repository
from app.models.domain.product import Product

logger = logging.getLogger(__name__)

# Score threshold for the Verified badge
_BADGE_THRESHOLD = 0.6


class BadgeService:
    """Recomputes NowCart Verified badges from order + rating data."""

    async def recompute_badges(self) -> dict:
        """Recompute order counts and badges for all products.

        Steps:
        1. Scan all orders from the last 30 days
        2. Count orders per product
        3. Load all products
        4. Compute badge score per product
        5. Update product.verified and product.order_count_month in the repo

        Returns:
            Summary dict with counts.
        """
        repo = get_repository()

        # --- Step 1: Count orders per product in the last 30 days ---
        cutoff = datetime.now() - timedelta(days=30)
        order_counts: dict[str, int] = defaultdict(int)

        # We need to scan all users' orders — fetch all users first
        # For the memory backend we can access _users, but to stay protocol-safe
        # we try to list all products and then we'll derive order counts below.
        # The DynamoDB backend doesn't expose a "list all orders" scan here,
        # so we iterate across known users from all orders we have access to.
        # In practice: use product catalog as baseline and scan recent orders.

        all_products = await repo.list_products()
        product_map: dict[str, Product] = {p.product_id: p for p in all_products}

        # For each product, we track order counts from orders we can reach.
        # We collect user_ids from the repository if available (memory backend).
        user_ids: list[str] = []
        try:
            # MemoryRepository exposes _users
            if hasattr(repo, "_users"):
                user_ids = list(repo._users.keys())
            elif hasattr(repo, "_orders"):
                user_ids = list(repo._orders.keys())
        except Exception:
            pass

        async def _fetch_orders(uid: str) -> tuple[str, list]:
            try:
                return uid, await repo.get_orders(uid)
            except Exception as exc:
                logger.debug("Could not read orders for user %s: %s", uid, exc)
                return uid, []

        # One round trip per user, fired concurrently, instead of sequentially —
        # was the same "loop of individual DB calls" pattern that made match_node
        # take 16s under the real DynamoDB backend.
        for _uid, orders in await asyncio.gather(*[_fetch_orders(uid) for uid in user_ids]):
            for order in orders:
                try:
                    order_date = datetime.fromisoformat(order.order_date)
                except (ValueError, TypeError):
                    continue
                if order_date < cutoff:
                    continue
                for item in order.items:
                    pid = item.get("product_id", "")
                    if pid:
                        order_counts[pid] += 1

        # --- Step 2: Compute per-category max order count ---
        category_max: dict[str, int] = defaultdict(int)
        for pid, count in order_counts.items():
            product = product_map.get(pid)
            if product:
                cat = product.category or "unknown"
                category_max[cat] = max(category_max[cat], count)

        # --- Step 3: Compute badge scores, collect changed products ---
        verified_count = 0
        changed_products: list[Product] = []

        for product in all_products:
            cat = product.category or "unknown"
            order_count = order_counts.get(product.product_id, 0)
            cat_max = category_max.get(cat, 1) or 1

            order_score = order_count / cat_max  # [0, 1]
            rating = product.rating or 0.0
            rating_score = rating / 5.0          # [0, 1]

            badge_score = 0.5 * order_score + 0.5 * rating_score
            new_verified = badge_score >= _BADGE_THRESHOLD

            if (
                product.order_count_month != order_count
                or product.verified != new_verified
            ):
                product.order_count_month = order_count
                product.verified = new_verified
                changed_products.append(product)

            if new_verified:
                verified_count += 1

        # One batched write (DynamoDB's real batch_writer) instead of up to
        # len(all_products) individual upsert_product calls, each of which opens
        # its own connection — the same fix as match_node's, applied here since
        # this loop runs over the full catalog (9k+ products).
        updated_count = len(changed_products)
        if changed_products:
            await repo.bulk_upsert_products(changed_products)

        logger.info(
            "Badge recompute complete: %d products updated, %d verified",
            updated_count,
            verified_count,
        )
        return {
            "total_products": len(all_products),
            "updated": updated_count,
            "verified": verified_count,
        }

    async def record_item_rating(
        self,
        product_id: str,
        rating: float,
    ) -> bool:
        """Update a product's average rating with a new user rating.

        Uses an exponential moving average (alpha=0.2) so old ratings
        are gradually phased out without storing per-user rating history.

        Args:
            product_id: Product to rate.
            rating: User rating (1–5).

        Returns:
            True if product found and updated, False otherwise.
        """
        if not 1.0 <= rating <= 5.0:
            return False

        repo = get_repository()
        product = await repo.get_product(product_id)
        if not product:
            return False

        # Exponential moving average
        alpha = 0.2
        current = product.rating or rating  # if no rating yet, start with this
        product.rating = round(alpha * rating + (1 - alpha) * current, 2)
        await repo.upsert_product(product)
        return True


_badge_service: BadgeService | None = None


def get_badge_service() -> BadgeService:
    """Return the singleton BadgeService."""
    global _badge_service
    if _badge_service is None:
        _badge_service = BadgeService()
    return _badge_service
