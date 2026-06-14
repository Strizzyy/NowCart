"""Outcome Service — orchestrates the LangGraph engine and persists the cart.

Entry point for all front-door inputs. Now enriched with:
- User preference injection (personalized matching)
- Pantry awareness (subtracts what user already has)
- Re-planning support (feedback loop for conversational refinement)
- Counterfactual data passthrough
"""
from __future__ import annotations

import logging
import time
import uuid
from functools import lru_cache

from app.agents.graph import outcome_graph
from app.agents.state import AgentState
from app.models.domain.cart import Cart
from app.models.domain.enums import IntentMode
from app.repositories import get_cache

logger = logging.getLogger(__name__)


class OutcomeService:
    """Run the Outcome Engine pipeline and persist the cart."""

    async def process_outcome(
        self,
        text: str,
        servings: int | None = None,
        mode: IntentMode | None = None,
        user_id: str | None = None,
        feedback: str | None = None,
    ) -> Cart:
        """Process a user's natural-language outcome into a confident cart.

        Args:
            text: Raw user input (e.g. "Biryani for 4").
            servings: Optional explicit servings override.
            mode: Optional mode override (skips intent classification).
            user_id: Authenticated user ID for personalization.
            feedback: User feedback for re-planning loop.

        Returns:
            The assembled Cart domain model (also persisted to cache).
        """
        pipeline_start = time.perf_counter()

        # Build initial state
        initial_state: AgentState = {
            "raw_input": text,
            "reasoning_trail": [],
            "replan_count": 0,
        }
        if servings is not None:
            initial_state["servings"] = servings
        if mode is not None:
            initial_state["mode"] = mode
        if user_id:
            initial_state["user_id"] = user_id
        if feedback:
            initial_state["feedback"] = feedback

        # Enrich with user context if user_id is available
        if user_id:
            await self._inject_user_context(initial_state, user_id)

        try:
            # Invoke the compiled graph
            result = await outcome_graph.ainvoke(initial_state)

            # Extract cart from final state
            cart: Cart | None = result.get("cart")

            if cart is None:
                cart = Cart(
                    session_id=str(uuid.uuid4()),
                    mode=result.get("mode", IntentMode.TEXT),
                    confidence=0.0,
                    notes=["Engine completed but produced no cart items."],
                    degraded=True,
                )

            # Attach clarification from confidence node
            clarification = result.get("clarification")
            if clarification and not cart.clarification:
                cart.clarification = clarification

            # Surface the engine's decision log
            if not cart.reasoning_trail:
                cart.reasoning_trail = result.get("reasoning_trail", []) or []

            # Attach pantry info to notes if items were filtered
            pantry_filtered = result.get("pantry_filtered", [])
            if pantry_filtered:
                cart.notes.append(
                    f"🏠 Skipped {len(pantry_filtered)} items you likely have: "
                    + ", ".join(pantry_filtered[:5])
                )

            # Store counterfactuals in cart metadata (accessible via API)
            counterfactuals = result.get("counterfactuals", {})
            if counterfactuals:
                # Store as a reasoning trail entry for now (lightweight)
                cart.reasoning_trail.append(
                    f"💡 Counterfactuals available for {len(counterfactuals)} items"
                )

        except Exception as exc:
            logger.exception("Outcome engine failed: %s", exc)
            cart = Cart(
                session_id=str(uuid.uuid4()),
                mode=mode or IntentMode.TEXT,
                confidence=0.0,
                notes=[f"Engine error: {exc}"],
                degraded=True,
            )

        # Pipeline telemetry
        pipeline_ms = (time.perf_counter() - pipeline_start) * 1000.0
        logger.info(
            "Pipeline complete: %.0fms | mode=%s | items=%d | confidence=%.2f | user=%s | input='%s'",
            pipeline_ms,
            cart.mode.value,
            len(cart.items),
            cart.confidence,
            user_id or "anonymous",
            text[:60],
        )

        # Persist to cache
        try:
            cache = get_cache()
            await cache.save_cart(cart.session_id, cart)
        except Exception as exc:
            logger.warning("Failed to persist cart to cache: %s", exc)

        return cart

    async def replan_cart(
        self,
        text: str,
        feedback: str,
        user_id: str | None = None,
        servings: int | None = None,
    ) -> Cart:
        """Re-plan an existing cart based on user feedback.

        This invokes the graph with feedback set, triggering the
        re-planning loop (replan → match → optimize → ... ).

        Args:
            text: Original input text.
            feedback: User feedback (e.g., "make it cheaper", "I'm vegan").
            user_id: User ID for personalization.
            servings: Original servings.

        Returns:
            A refined Cart.
        """
        return await self.process_outcome(
            text=text,
            servings=servings,
            user_id=user_id,
            feedback=feedback,
        )

    async def _inject_user_context(self, state: AgentState, user_id: str) -> None:
        """Enrich the initial state with user preferences and pantry data.

        This enables:
        - preference_boost_node to personalize confidence scores
        - pantry_filter_node to subtract items user already has
        """
        try:
            from app.services.preference_service import get_preference_service
            pref_service = get_preference_service()
            preference = await pref_service.get_user_preference(user_id)
            if preference:
                state["user_preferences"] = preference.model_dump()
        except Exception as exc:
            logger.debug("Could not load user preferences: %s", exc)

        try:
            from app.services.pantry_service import get_pantry_service
            pantry_service = get_pantry_service()
            pantry = await pantry_service.get_pantry(user_id)
            if pantry:
                state["pantry_items"] = [item.model_dump() for item in pantry]
        except Exception as exc:
            logger.debug("Could not load pantry: %s", exc)


@lru_cache
def get_outcome_service() -> OutcomeService:
    """Singleton factory for OutcomeService."""
    return OutcomeService()
