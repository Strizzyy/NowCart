"""Counterfactual Service — "Why NOT this one?" explanations.

When the engine collapses 6 options to 1 pick, this service generates
explanations for why the other 5 lost. This builds trust and enables
informed user overrides.

Example output:
- "Amul Ghee — not picked: 2x more expensive than your usual"
- "Fortune Oil — not picked: palm oil blend, you prefer sunflower"
- "Local Brand Paneer — not picked: no ratings, lower match confidence"

This is a first-class UI element: users can tap any cart item to see
rejected alternatives with reasons. Genuinely rare in e-commerce UX.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models.domain.product import Product
from app.repositories import get_repository
from app.services.preference_service import UserPreference

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class RejectedAlternative:
    """A product that was considered but not selected, with explanation."""

    def __init__(
        self,
        product_id: str,
        name: str,
        brand: str,
        price: float,
        score: float,
        rejection_reasons: list[str],
        image_url: str | None = None,
    ):
        self.product_id = product_id
        self.name = name
        self.brand = brand
        self.price = price
        self.score = score
        self.rejection_reasons = rejection_reasons
        self.image_url = image_url

    def to_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "name": self.name,
            "brand": self.brand,
            "price": self.price,
            "match_score": round(self.score, 1),
            "rejection_reasons": self.rejection_reasons,
            "image_url": self.image_url,
        }


class CounterfactualService:
    """Generate "why not" explanations for rejected product alternatives."""

    async def explain_rejections(
        self,
        selected_product_id: str,
        candidates: list[tuple[str, str, float, float, str | None]],
        preference: UserPreference | None = None,
    ) -> list[dict]:
        """For a selected product, explain why each alternative was not picked.

        Args:
            selected_product_id: The product that WAS selected.
            candidates: List of (product_id, name, score, price, image_url) tuples
                       from the match node.
            preference: Optional user preference for personalized explanations.

        Returns:
            List of RejectedAlternative dicts with reasons.
        """
        repo = get_repository()
        selected = await repo.get_product(selected_product_id)
        if not selected:
            return []

        rejections: list[dict] = []

        for pid, name, score, price, image_url in candidates:
            if pid == selected_product_id:
                continue

            product = await repo.get_product(pid)
            reasons = self._generate_reasons(
                selected=selected,
                alternative=product or Product(product_id=pid, name=name, sale_price=price),
                alt_score=score,
                selected_score=next(
                    (s for p, n, s, pr, img in candidates if p == selected_product_id),
                    100.0,
                ),
                preference=preference,
            )

            rejections.append(RejectedAlternative(
                product_id=pid,
                name=name,
                brand=product.brand if product else "",
                price=price,
                score=score,
                rejection_reasons=reasons,
                image_url=image_url,
            ).to_dict())

        return rejections

    def _generate_reasons(
        self,
        selected: Product,
        alternative: Product,
        alt_score: float,
        selected_score: float,
        preference: UserPreference | None = None,
    ) -> list[str]:
        """Generate human-readable rejection reasons comparing two products."""
        reasons: list[str] = []

        # 1. Match score difference
        score_diff = selected_score - alt_score
        if score_diff > 15:
            reasons.append(f"Lower match confidence ({alt_score:.0f}% vs {selected_score:.0f}%)")

        # 2. Price comparison
        price_diff = alternative.sale_price - selected.sale_price
        if price_diff > 0:
            pct = round(price_diff / max(selected.sale_price, 1) * 100)
            if pct > 50:
                reasons.append(f"{pct}% more expensive (₹{alternative.sale_price} vs ₹{selected.sale_price})")
            elif pct > 15:
                reasons.append(f"₹{price_diff:.0f} more expensive")
        elif price_diff < -20:
            # Cheaper but still not selected — there's another reason
            reasons.append(f"₹{abs(price_diff):.0f} cheaper but lower quality match")

        # 3. Rating comparison
        sel_rating = selected.rating or 0
        alt_rating = alternative.rating or 0
        if sel_rating > 0 and alt_rating > 0:
            if sel_rating - alt_rating > 0.5:
                reasons.append(f"Lower rated ({alt_rating}★ vs {sel_rating}★)")
        elif sel_rating > 0 and alt_rating == 0:
            reasons.append("No ratings available")

        # 4. Brand preference (if user has preference data)
        if preference and preference.brand_affinity:
            sel_brand_count = preference.brand_affinity.get(selected.brand, 0)
            alt_brand_count = preference.brand_affinity.get(alternative.brand, 0)
            if sel_brand_count > alt_brand_count and sel_brand_count >= 2:
                reasons.append(f"You prefer {selected.brand} over {alternative.brand}")

        # 5. Stock status
        if not alternative.in_stock:
            reasons.append("Currently out of stock")

        # Ensure at least one reason
        if not reasons:
            if alt_score < selected_score:
                reasons.append("Lower overall match score")
            else:
                reasons.append("Selected product better fits overall criteria")

        return reasons[:3]  # Cap at 3 reasons for readability

    async def get_counterfactuals_for_cart_item(
        self,
        need_name: str,
        selected_product_id: str,
        candidates: list[tuple[str, str, float, float, str | None]],
        user_id: str | None = None,
    ) -> dict:
        """Get full counterfactual explanation for a single cart item.

        Returns a dict suitable for the frontend "Why this one?" expansion panel.
        """
        preference = None
        if user_id:
            from app.services.preference_service import get_preference_service
            pref_service = get_preference_service()
            preference = await pref_service.get_user_preference(user_id)

        rejections = await self.explain_rejections(
            selected_product_id=selected_product_id,
            candidates=candidates,
            preference=preference,
        )

        return {
            "need": need_name,
            "selected_product_id": selected_product_id,
            "alternatives_considered": len(candidates) - 1,
            "rejected": rejections,
        }


_counterfactual_service: CounterfactualService | None = None


def get_counterfactual_service() -> CounterfactualService:
    """Return the singleton CounterfactualService."""
    global _counterfactual_service
    if _counterfactual_service is None:
        _counterfactual_service = CounterfactualService()
    return _counterfactual_service
