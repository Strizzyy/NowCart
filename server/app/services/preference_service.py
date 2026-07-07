"""User Preference / Memory Service — gives the engine a brain that remembers.

Builds and maintains a per-user preference profile from order history:
- Brand affinity (which brands they buy repeatedly)
- Price sensitivity (budget vs premium shopper)
- Category frequency (what they buy most often)
- Dietary signals (veg/non-veg/organic patterns)
- Product loyalty (specific products repurchased)

This profile is used by the confidence_node to:
1. Boost confidence for products matching user preferences
2. Provide personalized "why this one" explanations
3. Enable the "Zero Door" predictive cart

The preference model is lightweight and deterministic — no ML training needed.
It's computed on-demand from order history and cached.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from functools import lru_cache

from pydantic import BaseModel, Field

from app.models.domain.order import Order
from app.models.domain.product import Product
from app.repositories import get_repository, get_cache

logger = logging.getLogger(__name__)


class UserPreference(BaseModel):
    """Computed preference profile for a user — the "taste graph"."""

    user_id: str
    # Brand affinity: brand_name → purchase count
    brand_affinity: dict[str, int] = Field(default_factory=dict)
    # Category frequency: category → purchase count
    category_frequency: dict[str, int] = Field(default_factory=dict)
    # Product loyalty: product_id → purchase count (repurchased items)
    product_loyalty: dict[str, int] = Field(default_factory=dict)
    # Price profile
    avg_item_price: float = 0.0
    price_tier: str = "mid"  # "budget", "mid", "premium"
    # Dietary signals
    dietary_tags: list[str] = Field(default_factory=list)  # ["vegetarian", "organic", etc.]
    # Shopping patterns
    total_orders: int = 0
    avg_items_per_order: float = 0.0
    # Top products (for quick access)
    top_products: list[str] = Field(default_factory=list)  # top 10 product_ids by frequency
    top_brands: list[str] = Field(default_factory=list)  # top 5 brands


class PreferenceService:
    """Builds and queries user preference profiles from order history."""

    async def get_user_preference(self, user_id: str) -> UserPreference | None:
        """Get or compute the user's preference profile.

        Checks cache first, recomputes from order history if stale/missing.

        Returns:
            UserPreference if user has order history, None for new users.
        """
        # Check cache
        cache = get_cache()
        cached_raw = await cache._get(f"pref:{user_id}")
        if cached_raw:
            try:
                return UserPreference.model_validate_json(cached_raw)
            except Exception:
                pass

        # Compute from order history
        repo = get_repository()
        orders = await repo.get_orders(user_id)
        if not orders:
            return None

        preference = await self._compute_preference(user_id, orders)

        # Cache for 1 hour
        try:
            await cache._set(f"pref:{user_id}", preference.model_dump_json(), ttl=3600)
        except Exception:
            pass

        return preference

    async def _compute_preference(self, user_id: str, orders: list[Order]) -> UserPreference:
        """Compute preference profile from order history."""
        import asyncio
        repo = get_repository()

        brand_counter: Counter = Counter()
        category_counter: Counter = Counter()
        product_counter: Counter = Counter()
        prices: list[float] = []
        total_items = 0
        category_tags: set[str] = set()

        # Non-veg indicators
        non_veg_categories = {"eggs meat fish", "mutton lamb", "fish seafood"}
        organic_keywords = {"organic", "natural", "farm fresh"}

        # Collect all order items first (no I/O yet)
        all_items: list[dict] = []
        for order in orders:
            for item in order.items:
                all_items.append(item)
                product_id = item.get("product_id", "")
                price = item.get("price", 0)
                quantity = item.get("quantity", 1)
                product_counter[product_id] += quantity
                prices.append(price)
                total_items += quantity

        # Batch-fetch all products concurrently instead of serially
        unique_pids = list({item.get("product_id", "") for item in all_items if item.get("product_id")})
        products_list = await asyncio.gather(
            *[repo.get_product(pid) for pid in unique_pids],
            return_exceptions=False,
        )
        product_map: dict[str, object] = {
            pid: prod for pid, prod in zip(unique_pids, products_list) if prod is not None
        }

        for item in all_items:
            product_id = item.get("product_id", "")
            quantity = item.get("quantity", 1)
            product = product_map.get(product_id)
            if product:
                if product.brand:
                    brand_counter[product.brand] += quantity
                if product.category:
                    category_counter[product.category] += quantity
                # Dietary detection
                cat_lower = product.category.lower()
                if cat_lower in non_veg_categories:
                    category_tags.add("non-vegetarian")
                if any(kw in product.name.lower() for kw in organic_keywords):
                    category_tags.add("organic-preference")

        # Determine price tier
        avg_price = sum(prices) / len(prices) if prices else 0
        if avg_price < 80:
            price_tier = "budget"
        elif avg_price > 200:
            price_tier = "premium"
        else:
            price_tier = "mid"

        # Dietary: if no non-veg purchases, likely vegetarian
        if "non-vegetarian" not in category_tags and total_items > 5:
            category_tags.add("vegetarian")

        # Top products and brands
        top_products = [pid for pid, _ in product_counter.most_common(10)]
        top_brands = [brand for brand, _ in brand_counter.most_common(5)]

        return UserPreference(
            user_id=user_id,
            brand_affinity=dict(brand_counter.most_common(20)),
            category_frequency=dict(category_counter.most_common(15)),
            product_loyalty=dict(product_counter.most_common(20)),
            avg_item_price=round(avg_price, 2),
            price_tier=price_tier,
            dietary_tags=sorted(category_tags),
            total_orders=len(orders),
            avg_items_per_order=round(total_items / len(orders), 1) if orders else 0,
            top_products=top_products,
            top_brands=top_brands,
        )

    def compute_preference_boost(
        self,
        product: Product,
        preference: UserPreference,
    ) -> tuple[float, str]:
        """Compute a confidence boost factor and reason for a product based on user prefs.

        Returns:
            Tuple of (boost_factor, reason_string).
            boost_factor: 0.0 to 0.15 (additive to confidence score)
            reason: Human-readable explanation ("you've bought this brand 5 times")
        """
        boost = 0.0
        reasons: list[str] = []

        # Product loyalty: user bought this exact product before
        if product.product_id in preference.product_loyalty:
            count = preference.product_loyalty[product.product_id]
            boost += min(0.10, count * 0.03)  # max +10% for repeat purchases
            reasons.append(f"you've bought this {count}x before")

        # Brand affinity
        if product.brand and product.brand in preference.brand_affinity:
            brand_count = preference.brand_affinity[product.brand]
            boost += min(0.05, brand_count * 0.01)  # max +5% for brand loyalty
            if not reasons:
                reasons.append(f"you prefer {product.brand} (bought {brand_count}x)")

        # Price alignment
        if preference.price_tier == "budget" and product.sale_price < preference.avg_item_price * 0.8:
            boost += 0.03
            if not reasons:
                reasons.append("fits your budget preference")
        elif preference.price_tier == "premium" and product.sale_price > preference.avg_item_price * 1.2:
            boost += 0.02
            if not reasons:
                reasons.append("matches your premium taste")

        reason_str = "; ".join(reasons) if reasons else ""
        return (min(boost, 0.15), reason_str)

    def get_personalized_reason(
        self,
        product: Product,
        preference: UserPreference,
        base_reason: str,
    ) -> str:
        """Enhance a base reason with personalized context.

        Turns generic "Best match (score=85)" into
        "Best match — you've bought Amul 5x, organic, best price-per-litre"
        """
        _, pref_reason = self.compute_preference_boost(product, preference)
        if pref_reason:
            return f"{base_reason} — {pref_reason}"
        return base_reason


_preference_service: PreferenceService | None = None


def get_preference_service() -> PreferenceService:
    """Return the singleton PreferenceService."""
    global _preference_service
    if _preference_service is None:
        _preference_service = PreferenceService()
    return _preference_service
