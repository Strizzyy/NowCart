"""AgentState — the shared state flowing through the LangGraph Outcome Engine.

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
        mode: Classified intent mode (recipe, budget, photo, link, subscribe, cart_op, text).
        servings: Serving count extracted from input (default 1, for scaling).
        needs: Decomposed needs from the outcome.
        candidates: need_name → list of (product_id, name, score, price, image_url) tuples.
        cart: The assembled cart.
        substitutions: Substitution records (kept for backward compat, now unused in pipeline).
        confidence: Overall cart confidence score (0–1).
        reasoning_trail: Agent decision log.
        clarification: HITL question if confidence below threshold, else None.

        --- User Context (Memory Layer) ---
        user_id: Authenticated user ID for personalization.
        user_region: Region string ("north" | "south" | "east" | "west" | "central").
        user_preferences: Computed preference profile (brand affinity, price tier, etc.).

        --- Re-planning (Conversational Loop) ---
        feedback: User feedback for re-planning (e.g., "make it cheaper", "I'm vegan").
        replan_count: Number of times the graph has re-planned (prevents infinite loops).
        constraints: Additional constraints from feedback (dietary, price, swap requests).

        --- Counterfactuals ---
        counterfactuals: need_name → list of rejected alternatives with reasons.
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

    # User context
    user_id: str | None
    user_region: str | None       # region-aware decompose
    user_age: int | None          # new-user starter cart personalisation
    user_gender: str | None       # new-user starter cart personalisation
    user_preferences: dict        # serialized UserPreference

    # Re-planning
    feedback: str | None
    replan_count: int
    constraints: dict  # {"dietary": ["vegan"], "max_price": 500, "swap": {"paneer": "tofu"}}
    excluded_items: list[str]  # item names the user explicitly wants removed (e.g. ["onion", "garlic"])

    # Cart augmentation — set by replan_node for additive feedback
    # When True, decompose_node uses an augment prompt instead of rebuilding from scratch.
    preserve_cart: bool
    # Items from the existing cart that must be carried forward unchanged.
    locked_items: list[dict]  # [{"name": str, "price": float, "quantity": float}]
    # Original meal context (e.g. "pasta for 2") — threaded through replan for augment prompts.
    meal_context: str | None

    # Short-circuit flags set by replan_node to skip the LLM entirely for
    # pure removal or pure "make cheaper" requests.
    # skip_decompose=True  → replan routes directly to match (no LLM call)
    # use_economical=True  → match_node picks cheapest candidate, not best-scoring
    skip_decompose: bool
    use_economical: bool

    # Counterfactuals
    counterfactuals: dict[str, list[dict]]
