"""LangGraph StateGraph wiring for the Outcome Engine.

Streamlined pipeline:

    intent → decompose (region-aware) → match → confidence_check
    → [conditional: replan or continue] → counterfactual → END

Re-planning loop:
    confidence_check → replan → [conditional on skip_decompose] →
        decompose → match  (ADDITIVE / REBUILD — LLM call needed)
        match              (REMOVAL / CHEAPER — no LLM, direct to match)

Intent modes set by replan_node:
    REMOVAL   skip_decompose=True                → replan → match
    CHEAPER   skip_decompose=True, use_economical=True → replan → match
    ADDITIVE  preserve_cart=True                 → replan → decompose → match
    REBUILD   preserve_cart=False                → replan → decompose → match
    MIXED     falls back to REBUILD path
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
# Conditional edge: after confidence_check
# ---------------------------------------------------------------------------

def _should_replan(state: AgentState) -> str:
    """Route to 'replan' if user feedback is present and iteration cap not hit."""
    feedback = state.get("feedback")
    replan_count = state.get("replan_count", 0)
    if feedback and replan_count < 2:
        return "replan"
    return "counterfactual"


# ---------------------------------------------------------------------------
# Conditional edge: after replan — skip decompose for removal/cheaper
# ---------------------------------------------------------------------------

def _replan_route(state: AgentState) -> str:
    """Skip the LLM decompose step for pure removal or cheaper intents."""
    if state.get("skip_decompose", False):
        return "match"
    return "decompose"


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

# Conditional edge after replan: LLM path or direct-to-match path
_builder.add_conditional_edges(
    "replan",
    _replan_route,
    {
        "decompose": "decompose",
        "match": "match",
    },
)

# Counterfactual → END
_builder.add_edge("counterfactual", END)

# Compile into a runnable
outcome_graph = _builder.compile()
