"""Outcome Service — orchestrates the LangGraph engine and persists the cart.

Entry point for all front-door inputs. Builds initial state, invokes the
compiled graph, extracts the resulting Cart, and saves it to the cache layer.

Includes per-node telemetry: logs time spent in each pipeline stage
(intent, decompose, match, optimize, substitute, confidence) for
observability and scaling decisions.
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
    ) -> Cart:
        """Process a user's natural-language outcome into a confident cart.

        Args:
            text: Raw user input (e.g. "Biryani for 4").
            servings: Optional explicit servings override.
            mode: Optional mode override (skips intent classification).

        Returns:
            The assembled Cart domain model (also persisted to cache).
        """
        pipeline_start = time.perf_counter()

        # Build initial state
        initial_state: AgentState = {
            "raw_input": text,
            "reasoning_trail": [],
        }
        if servings is not None:
            initial_state["servings"] = servings
        if mode is not None:
            initial_state["mode"] = mode

        try:
            # Invoke the compiled graph
            result = await outcome_graph.ainvoke(initial_state)

            # Extract cart from final state
            cart: Cart | None = result.get("cart")

            if cart is None:
                # Fallback: graph completed but produced no cart
                cart = Cart(
                    session_id=str(uuid.uuid4()),
                    mode=result.get("mode", IntentMode.TEXT),
                    confidence=0.0,
                    notes=["Engine completed but produced no cart items."],
                    degraded=True,
                )

            # Attach clarification from confidence node if present
            clarification = result.get("clarification")
            if clarification and not cart.clarification:
                cart.clarification = clarification

            # Surface the engine's decision log for the comparison-collapse UI (C2/C3)
            if not cart.reasoning_trail:
                cart.reasoning_trail = result.get("reasoning_trail", []) or []

        except Exception as exc:
            logger.exception("Outcome engine failed: %s", exc)
            # Graceful degradation: return a degraded cart with error info
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
            "Pipeline complete: %.0fms | mode=%s | items=%d | confidence=%.2f | input='%s'",
            pipeline_ms,
            cart.mode.value,
            len(cart.items),
            cart.confidence,
            text[:60],
        )

        # Persist to cache
        try:
            cache = get_cache()
            await cache.save_cart(cart.session_id, cart)
        except Exception as exc:
            logger.warning("Failed to persist cart to cache: %s", exc)

        return cart


@lru_cache
def get_outcome_service() -> OutcomeService:
    """Singleton factory for OutcomeService."""
    return OutcomeService()
