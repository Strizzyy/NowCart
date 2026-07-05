"""Outcome Service — orchestrates the LangGraph engine and persists the cart.

Entry point for all front-door inputs. Enriched with:
- Region-aware decompose (user location → regional ingredient hints)
- Recently-ordered prompt (post-assembly: marks items ordered in last 30 days)
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
        locked_items: list[dict] | None = None,
    ) -> Cart:
        """Process a user's natural-language outcome into a confident cart."""
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
        if locked_items:
            initial_state["locked_items"] = locked_items

        # Inject user region for region-aware decompose
        if user_id:
            await self._inject_user_context(initial_state, user_id)

        try:
            result = await outcome_graph.ainvoke(initial_state)
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

            # Attach counterfactual summary
            counterfactuals = result.get("counterfactuals", {})
            if counterfactuals:
                cart.reasoning_trail.append(
                    f"💡 Counterfactuals available for {len(counterfactuals)} items"
                )

            # Post-assembly: mark recently-ordered items for the prompt
            if user_id and cart.items:
                await self._annotate_recently_ordered(cart, user_id)

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
        cart_items: list[dict] | None = None,
    ) -> Cart:
        """Re-plan an existing cart based on user feedback.

        cart_items: the current cart items from the frontend.
        text: the original meal context (e.g. "pasta for 2") extracted from cart notes,
              NOT just a list of item names.

        Passes preserve_cart=True and locked_items into state so decompose_node
        uses an augment prompt — keeping existing items unless feedback demands removal.
        """
        locked_items: list[dict] = []
        if cart_items:
            locked_items = [
                {
                    "product_id": item.get("product_id", ""),
                    "name": item["name"],
                    "brand": item.get("brand", ""),
                    "price": item.get("price", 0),
                    "quantity": item.get("quantity", 1),
                    "image_url": item.get("image_url"),
                }
                for item in cart_items
                if item.get("product_id")  # only keep items with a known product_id
            ]

        return await self.process_outcome(
            text=text,
            servings=servings,
            user_id=user_id,
            feedback=feedback,
            locked_items=locked_items if locked_items else None,
        )

    async def _inject_user_context(self, state: AgentState, user_id: str) -> None:
        """Inject user region, age, and gender into state for personalised decompose."""
        try:
            from app.repositories import get_repository
            repo = get_repository()
            user = await repo.get_user(user_id)
            if user:
                if user.location and user.location.region:
                    state["user_region"] = user.location.region
                if user.age:
                    state["user_age"] = user.age
                if user.gender:
                    state["user_gender"] = user.gender
        except Exception as exc:
            logger.debug("Could not load user context: %s", exc)

        try:
            from app.services.preference_service import get_preference_service
            pref_service = get_preference_service()
            preference = await pref_service.get_user_preference(user_id)
            if preference:
                state["user_preferences"] = preference.model_dump()
        except Exception as exc:
            logger.debug("Could not load user preferences: %s", exc)

    async def _annotate_recently_ordered(self, cart: Cart, user_id: str) -> None:
        """Mark cart items ordered in the last 30 days for the recently-ordered prompt."""
        try:
            from app.services.pantry_service import get_pantry_service
            pantry_service = get_pantry_service()
            product_ids = [item.product_id for item in cart.items]
            recently = await pantry_service.get_recently_ordered(user_id, product_ids)
            for item in cart.items:
                if item.product_id in recently:
                    item.recently_ordered = True
                    item.days_ago = recently[item.product_id]
        except Exception as exc:
            logger.debug("Could not annotate recently ordered items: %s", exc)


@lru_cache
def get_outcome_service() -> OutcomeService:
    """Singleton factory for OutcomeService."""
    return OutcomeService()
