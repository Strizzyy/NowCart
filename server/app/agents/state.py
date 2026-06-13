"""AgentState — the shared state flowing through the LangGraph Outcome Engine (Requirement 1.6).

Each node reads what it needs from state and returns a partial dict update.
LangGraph merges the returned dict back into state automatically.
"""
from __future__ import annotations

from typing import TypedDict

from app.models.domain.enums import IntentMode
from app.models.domain.need import Need
from app.models.domain.cart import Cart, Substitution


class AgentState(TypedDict, total=False):
    """Typed state bag for the Outcome Engine pipeline.

    Fields:
        raw_input: The user's natural language input.
        mode: Classified intent mode (recipe, budget, photo, link, sos, cart_op, text).
        servings: Serving count extracted from input (default 1, for scaling).
        needs: Decomposed needs from the outcome.
        candidates: need_name → list of (product_id, name, score, price) tuples.
        cart: The assembled cart.
        substitutions: Substitution records for out-of-stock swaps.
        confidence: Overall cart confidence score (0–1).
        reasoning_trail: Agent decision log.
        clarification: HITL question if confidence below threshold, else None.
    """

    raw_input: str
    mode: IntentMode
    servings: int
    needs: list[Need]
    candidates: dict[str, list[tuple[str, str, float, float]]]
    cart: Cart
    substitutions: list[Substitution]
    confidence: float
    reasoning_trail: list[str]
    clarification: str | None
