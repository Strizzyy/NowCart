"""LangGraph StateGraph wiring for the Outcome Engine.

Extended pipeline with pantry awareness, preference personalization,
counterfactual explanations, and a conversational re-planning loop:

    intent → decompose → pantry_filter → match → optimize → preference_boost
    → substitute → confidence_check → [conditional: replan or continue]
    → counterfactual → END

Re-planning loop:
    If confidence_check produces low confidence AND user feedback is available,
    the graph routes to replan → match → optimize → ... (max 2 iterations).

Exports:
    outcome_graph — compiled LangGraph runnable (invoke with AgentState dict).
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.nodes import (
    intent_node,
    decompose_node,
    pantry_filter_node,
    match_node,
    optimize_node,
    preference_boost_node,
    substitute_node,
    confidence_node,
    counterfactual_node,
    replan_node,
)


# ---------------------------------------------------------------------------
# Conditional edge: after confidence_check, decide whether to replan or finish
# ---------------------------------------------------------------------------

def _should_replan(state: AgentState) -> str:
    """Determine if the graph should re-plan based on feedback and confidence.

    Routes to "replan" if:
    1. User feedback is present (conversational refinement), AND
    2. We haven't exceeded max replan iterations (prevent infinite loops)

    Otherwise routes to "counterfactual" (normal completion path).
    """
    feedback = state.get("feedback")
    replan_count = state.get("replan_count", 0)

    if feedback and replan_count < 2:
        return "replan"
    return "counterfactual"


# ---------------------------------------------------------------------------
# Build the StateGraph
# ---------------------------------------------------------------------------

_builder = StateGraph(AgentState)

# Register nodes
_builder.add_node("intent", intent_node)
_builder.add_node("decompose", decompose_node)
_builder.add_node("pantry_filter", pantry_filter_node)
_builder.add_node("match", match_node)
_builder.add_node("optimize", optimize_node)
_builder.add_node("preference_boost", preference_boost_node)
_builder.add_node("substitute", substitute_node)
_builder.add_node("confidence_check", confidence_node)
_builder.add_node("counterfactual", counterfactual_node)
_builder.add_node("replan", replan_node)

# Wire edges — main pipeline
_builder.set_entry_point("intent")
_builder.add_edge("intent", "decompose")
_builder.add_edge("decompose", "pantry_filter")
_builder.add_edge("pantry_filter", "match")
_builder.add_edge("match", "optimize")
_builder.add_edge("optimize", "preference_boost")
_builder.add_edge("preference_boost", "substitute")
_builder.add_edge("substitute", "confidence_check")

# Conditional edge: replan or finish
_builder.add_conditional_edges(
    "confidence_check",
    _should_replan,
    {
        "replan": "replan",
        "counterfactual": "counterfactual",
    },
)

# Re-planning loop: replan → match (re-enters the matching pipeline)
_builder.add_edge("replan", "match")

# Counterfactual → END
_builder.add_edge("counterfactual", END)

# Compile into a runnable
outcome_graph = _builder.compile()
