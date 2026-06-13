"""Cart operations service — add/remove/update items in an existing cart (A2 follow-ups).

Handles voice or UI follow-up commands like "add 2 bananas", "remove the rice",
"what's my total?" on an existing session cart.
"""
from __future__ import annotations

from app.models.domain.cart import Cart, CartItem
from app.repositories import get_cache
from app.services.catalog_service import get_catalog_service


class CartOpsService:
    """Mutate an existing cart: add, remove, update items."""

    async def get_cart(self, session_id: str) -> Cart | None:
        """Retrieve a cart from cache by session ID."""
        cache = get_cache()
        return await cache.get_cart(session_id)

    async def save_cart(self, cart: Cart) -> None:
        """Persist a cart back to cache."""
        cache = get_cache()
        await cache.save_cart(cart.session_id, cart)

    async def add_item(self, session_id: str, entity: str, quantity: float = 1.0) -> Cart | None:
        """Add an item to the cart by fuzzy-matching the entity name.

        Returns:
            Updated cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        catalog = get_catalog_service()
        matches = await catalog.fuzzy_match_need(need_name=entity, top_k=3)

        if not matches:
            cart.notes.append(f"Could not find product matching: {entity}")
            await self.save_cart(cart)
            return cart

        # Pick first available
        for product, score in matches:
            if await catalog.check_availability(product.product_id):
                # Check if already in cart — increment quantity
                existing = next(
                    (item for item in cart.items if item.product_id == product.product_id),
                    None,
                )
                if existing:
                    existing.quantity += quantity
                else:
                    cart.items.append(
                        CartItem(
                            product_id=product.product_id,
                            name=product.name,
                            price=product.sale_price,
                            quantity=quantity,
                            unit=product.unit or "unit",
                            reason="Added via cart op",
                            confidence=min(score / 100.0, 1.0),
                        )
                    )
                cart.recompute_total()
                await self.save_cart(cart)
                return cart

        cart.notes.append(f"No in-stock product found for: {entity}")
        await self.save_cart(cart)
        return cart

    async def remove_item(self, session_id: str, entity: str) -> Cart | None:
        """Remove an item from the cart by fuzzy name match.

        Returns:
            Updated cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        entity_lower = entity.lower()

        # Find item by name (case-insensitive substring match)
        removed = False
        for i, item in enumerate(cart.items):
            if entity_lower in item.name.lower():
                cart.items.pop(i)
                removed = True
                break

        if not removed:
            cart.notes.append(f"Item not found in cart: {entity}")

        cart.recompute_total()
        await self.save_cart(cart)
        return cart

    async def update_quantity(
        self, session_id: str, entity: str, quantity: float
    ) -> Cart | None:
        """Update the quantity of an item in the cart.

        Returns:
            Updated cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        entity_lower = entity.lower()
        updated = False

        for item in cart.items:
            if entity_lower in item.name.lower():
                item.quantity = quantity
                updated = True
                break

        if not updated:
            cart.notes.append(f"Item not found for update: {entity}")

        cart.recompute_total()
        await self.save_cart(cart)
        return cart

    async def get_total(self, session_id: str) -> float | None:
        """Return the current cart total.

        Returns:
            Total amount, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None
        return cart.total


_cart_ops_service: CartOpsService | None = None


def get_cart_ops_service() -> CartOpsService:
    """Return the singleton CartOpsService."""
    global _cart_ops_service
    if _cart_ops_service is None:
        _cart_ops_service = CartOpsService()
    return _cart_ops_service
