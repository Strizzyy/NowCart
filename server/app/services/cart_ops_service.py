"""Cart operations service — add/remove/update items in an existing cart (A2 follow-ups).

Handles voice or UI follow-up commands like "add 2 bananas", "remove the rice",
"what's my total?" on an existing session cart.
"""
from __future__ import annotations

from app.models.domain.cart import Cart, CartItem
from app.repositories import get_cache
from app.services.catalog_service import get_catalog_service


async def _find_economical_alternative(
    entity: str,
    best_product_id: str,
    best_price: float,
    quantity: float,
    unit: str,
) -> CartItem | None:
    """Find the cheapest available alternative for a product.

    Searches the catalog for the same entity, then picks the cheapest
    in-stock product that is different from best_product_id.

    Returns:
        A CartItem for the economical pick, or None if no cheaper option exists.
    """
    catalog = get_catalog_service()
    matches = await catalog.fuzzy_match_need(need_name=entity, top_k=5)

    if not matches:
        return None

    # Collect all available candidates
    available: list[tuple] = []
    for product, score in matches:
        if await catalog.check_availability(product.product_id):
            available.append((product, score))

    if not available:
        return None

    # Sort by price ascending to find cheapest
    available.sort(key=lambda x: x[0].sale_price)

    # Pick cheapest that's different from best
    for product, score in available:
        if product.product_id != best_product_id:
            saving = round(best_price - product.sale_price, 2) if best_price > product.sale_price else 0
            reason = f"Budget-friendly pick (saves ₹{saving:.0f})" if saving > 0 else "Economical alternative"
            return CartItem(
                product_id=product.product_id,
                name=product.name,
                price=product.sale_price,
                quantity=quantity,
                unit=product.unit or unit,
                reason=reason,
                confidence=min(score / 100.0, 1.0),
                image_url=product.image_url,
            )

    # No different product found — return same item
    return None


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

        If session_id is empty or the cart doesn't exist, a new cart is created.
        Also finds and adds an economical alternative to economical_items.

        Returns:
            Updated cart, or None if session not found and no auto-create.
        """
        import uuid
        from app.models.domain.enums import IntentMode

        cart = None
        if session_id:
            cart = await self.get_cart(session_id)

        # Auto-create a fresh cart when none exists (e.g. first add-to-cart from search)
        if cart is None:
            cart = Cart(
                session_id=str(uuid.uuid4()),
                mode=IntentMode.TEXT,
                confidence=1.0,
            )

        catalog = get_catalog_service()
        matches = await catalog.fuzzy_match_need(need_name=entity, top_k=5)

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
                    # Also update corresponding economical item quantity
                    idx = cart.items.index(existing)
                    if idx < len(cart.economical_items):
                        cart.economical_items[idx].quantity = existing.quantity
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
                            image_url=product.image_url,
                        )
                    )

                    # Find economical alternative
                    eco_item = await _find_economical_alternative(
                        entity=entity,
                        best_product_id=product.product_id,
                        best_price=product.sale_price,
                        quantity=quantity,
                        unit=product.unit or "unit",
                    )
                    if eco_item:
                        cart.economical_items.append(eco_item)
                    else:
                        # No cheaper alternative — mirror the same item
                        cart.economical_items.append(
                            CartItem(
                                product_id=product.product_id,
                                name=product.name,
                                price=product.sale_price,
                                quantity=quantity,
                                unit=product.unit or "unit",
                                reason="Same as recommended (no cheaper option)",
                                confidence=min(score / 100.0, 1.0),
                                image_url=product.image_url,
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
        Also removes the corresponding economical item.

        Returns:
            Updated cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        entity_lower = entity.lower()

        # Find item by name (case-insensitive substring match)
        removed_idx = -1
        for i, item in enumerate(cart.items):
            if entity_lower in item.name.lower():
                cart.items.pop(i)
                removed_idx = i
                break

        if removed_idx == -1:
            cart.notes.append(f"Item not found in cart: {entity}")
        else:
            # Remove corresponding economical item (same index)
            if removed_idx < len(cart.economical_items):
                cart.economical_items.pop(removed_idx)

        cart.recompute_total()
        await self.save_cart(cart)
        return cart

    async def update_quantity(
        self, session_id: str, entity: str, quantity: float
    ) -> Cart | None:
        """Update the quantity of an item in the cart.
        Also updates the corresponding economical item's quantity.

        Returns:
            Updated cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        entity_lower = entity.lower()
        updated = False

        for i, item in enumerate(cart.items):
            if entity_lower in item.name.lower():
                item.quantity = quantity
                # Update corresponding economical item quantity too
                if i < len(cart.economical_items):
                    cart.economical_items[i].quantity = quantity
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

    async def clear_cart(self, session_id: str) -> Cart | None:
        """Remove all items from the cart.

        Returns:
            The emptied cart, or None if session not found.
        """
        cart = await self.get_cart(session_id)
        if cart is None:
            return None

        cart.items.clear()
        cart.economical_items.clear()
        cart.substitutions.clear()
        cart.notes.clear()
        cart.reasoning_trail.clear()
        cart.recompute_total()
        await self.save_cart(cart)
        return cart


_cart_ops_service: CartOpsService | None = None


def get_cart_ops_service() -> CartOpsService:
    """Return the singleton CartOpsService."""
    global _cart_ops_service
    if _cart_ops_service is None:
        _cart_ops_service = CartOpsService()
    return _cart_ops_service
