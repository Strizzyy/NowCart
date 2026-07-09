"""Budget/constraint-first service (A3) — build a cart within a budget cap.

Constraint-first ordering: the user provides a budget and optional context,
and the engine fills the cart up to that limit, prioritizing essentials.
"""
from __future__ import annotations

import uuid

from app.models.domain.cart import Cart
from app.models.domain.enums import IntentMode
from app.services.outcome_service import get_outcome_service


class BudgetService:
    """Build a cart constrained to a budget cap."""

    async def build_constrained_cart(
        self,
        text: str,
        budget: float,
        servings: int = 1,
    ) -> Cart:
        """Run the outcome engine and trim the cart to fit within budget.

        Strategy: run normal pipeline, then drop lowest-confidence items
        until total ≤ budget. If even 1 item exceeds budget, return that
        single item with a shortfall note.

        Args:
            text: Outcome text (e.g. "dinner for 4").
            budget: Maximum spend in INR.
            servings: Serving count for scaling.

        Returns:
            Cart with total ≤ budget (or degraded if impossible).
        """
        # Build a rich prompt so the LLM knows the budget and headcount
        if text and text.lower() not in ("groceries", ""):
            llm_text = (
                f"{text} for {servings} {'person' if servings == 1 else 'people'} "
                f"within a budget of ₹{int(budget)}"
            )
        else:
            llm_text = (
                f"a complete Indian meal for {servings} {'person' if servings == 1 else 'people'} "
                f"within a budget of ₹{int(budget)}"
            )

        service = get_outcome_service()
        cart = await service.process_outcome(
            text=llm_text,
            servings=servings,
            mode=IntentMode.BUDGET,
        )

        # Apply budget constraint
        cart.budget = budget
        cart = self._trim_to_budget(cart, budget)
        return cart

    def _trim_to_budget(self, cart: Cart, budget: float) -> Cart:
        """Remove items until total ≤ budget using a greedy lowest-price-first strategy.

        Keeps as many items as possible within the budget by processing cheapest items
        first. This avoids the problem of keeping one expensive high-confidence item
        at the expense of many relevant cheap staples.
        """
        if cart.total <= budget:
            cart.remaining_budget = round(budget - cart.total, 2)
            return cart

        # Sort items by unit cost ascending — fill the cart with cheapest items first
        indexed_items = list(enumerate(cart.items))
        indexed_items.sort(key=lambda x: x[1].price * x[1].quantity)

        kept_indices: list[int] = []
        running_total = 0.0

        for orig_idx, item in indexed_items:
            item_cost = item.price * item.quantity
            if running_total + item_cost <= budget:
                kept_indices.append(orig_idx)
                running_total += item_cost
            else:
                cart.notes.append(f"Dropped (over budget): {item.name}")

        # Rebuild items and economical_items preserving original order
        kept_indices.sort()
        cart.items = [cart.items[i] for i in kept_indices]
        if cart.economical_items:
            cart.economical_items = [
                cart.economical_items[i] for i in kept_indices
                if i < len(cart.economical_items)
            ]

        cart.recompute_total()
        cart.remaining_budget = round(budget - cart.total, 2)

        if not cart.items:
            cart.shortfall = round(cart.total - budget, 2) if cart.total > budget else None
            cart.notes.append("Budget too low for any items in this outcome.")
            cart.degraded = True

        return cart

    def apply_budget(self, cart: Cart, budget: float) -> Cart:
        """Apply a budget constraint to an existing cart (post-hoc).

        Returns:
            The same cart object, trimmed to budget.
        """
        cart.budget = budget
        return self._trim_to_budget(cart, budget)


_budget_service: BudgetService | None = None


def get_budget_service() -> BudgetService:
    """Return the singleton BudgetService."""
    global _budget_service
    if _budget_service is None:
        _budget_service = BudgetService()
    return _budget_service