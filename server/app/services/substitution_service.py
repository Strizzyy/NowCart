"""Substitution service — find in-stock alternatives for OOS products (D2).

Provides standalone substitution logic that can be called outside the graph,
e.g. when a product goes OOS after cart creation, or for admin-triggered swaps.
"""
from __future__ import annotations

from app.models.domain.cart import Cart, CartItem, Substitution
from app.services.catalog_service import get_catalog_service


class SubstitutionService:
    """Find and apply in-stock substitutes for out-of-stock cart items."""

    async def find_substitute(self, product_id: str, product_name: str) -> dict | None:
        """Find an in-stock alternative for a single product.

        Returns:
            Dict with substitute info, or None if no substitute available.
        """
        catalog = get_catalog_service()

        # Get candidates via fuzzy match on the product name
        matches = await catalog.fuzzy_match_need(
            need_name=product_name,
            category_hint=None,
            top_k=10,
        )

        for product, score in matches:
            if product.product_id == product_id:
                continue
            if await catalog.check_availability(product.product_id):
                return {
                    "substitute_product_id": product.product_id,
                    "substitute_name": product.name,
                    "substitute_price": product.sale_price,
                    "score": score,
                    "reason": f"In-stock alternative (score={score:.0f})",
                }

        return None

    async def apply_substitutions(self, cart: Cart) -> list[Substitution]:
        """Check all cart items for stock and substitute OOS ones.

        Mutates the cart in-place and returns the substitution records.

        Returns:
            List of Substitution records for items that were swapped.
        """
        catalog = get_catalog_service()
        substitutions: list[Substitution] = []

        for i, item in enumerate(cart.items):
            if await catalog.check_availability(item.product_id):
                continue

            # Item is out of stock — find substitute
            sub = await self.find_substitute(item.product_id, item.name)
            if sub is None:
                cart.notes.append(f"No substitute for: {item.name}")
                continue

            substitutions.append(
                Substitution(
                    original_product_id=item.product_id,
                    original_name=item.name,
                    substitute_product_id=sub["substitute_product_id"],
                    substitute_name=sub["substitute_name"],
                    reason=sub["reason"],
                )
            )

            cart.items[i] = CartItem(
                product_id=sub["substitute_product_id"],
                name=sub["substitute_name"],
                price=sub["substitute_price"],
                quantity=item.quantity,
                unit=item.unit,
                reason=f"Substituted (original '{item.name}' out of stock)",
                confidence=min(sub["score"] / 100.0, 1.0),
                substituted_for=item.product_id,
            )

        cart.substitutions.extend(substitutions)
        cart.recompute_total()
        return substitutions


_substitution_service: SubstitutionService | None = None


def get_substitution_service() -> SubstitutionService:
    """Return the singleton SubstitutionService."""
    global _substitution_service
    if _substitution_service is None:
        _substitution_service = SubstitutionService()
    return _substitution_service
