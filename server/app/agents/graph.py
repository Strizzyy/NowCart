"""LangGraph StateGraph wiring for the Outcome Engine.

Streamlined pipeline:

    intent → decompose (region-aware) → match → confidence_check
    → [conditional: replan or continue] → counterfactual → END

Re-planning loop:
    If confidence_check detects user feedback AND replan_count < 2,
    the graph routes to replan → match (max 2 iterations).

Removed from previous pipeline:
    - pantry_filter  (replaced by recently-ordered prompt post-assembly)
    - optimize       (merged into match_node)
    - preference_boost (removed)
    - substitute     (replaced by OOS suggestion metadata on CartItem)

Exports:
    outcome_graph — compiled LangGraph runnable (invoke with AgentState dict).
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.nodes import (
    intent_node,
    decompose_node,
    match_node,
    confidence_node,
    counterfactual_node,
    replan_node,
)


# ---------------------------------------------------------------------------
# Conditional edge: after confidence_check, decide whether to replan or finish
# ---------------------------------------------------------------------------

def _should_replan(state: AgentState) -> str:
    """Route to 'replan' if user feedback is present and iteration cap not hit."""
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
_builder.add_node("match", match_node)
_builder.add_node("confidence_check", confidence_node)
_builder.add_node("counterfactual", counterfactual_node)
_builder.add_node("replan", replan_node)

# Wire edges — main pipeline
_builder.set_entry_point("intent")
_builder.add_edge("intent", "decompose")
_builder.add_edge("decompose", "match")
_builder.add_edge("match", "confidence_check")

# Conditional edge: replan or finish
_builder.add_conditional_edges(
    "confidence_check",
    _should_replan,
    {
        "replan": "replan",
        "counterfactual": "counterfactual",
    },
)

# Re-planning loop: replan → match
_builder.add_edge("replan", "match")

# Counterfactual → END
_builder.add_edge("counterfactual", END)

# Compile into a runnable
outcome_graph = _builder.compile()
