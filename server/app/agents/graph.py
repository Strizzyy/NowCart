"""LangGraph StateGraph wiring for the Outcome Engine (Requirement 1.6).

Linear pipeline:
    intent → decompose → match → optimize → substitute → confidence_check → END

The substitute_node is a no-op when all items are in-stock, so the linear
flow handles both the happy path and the out-of-stock conditional gracefully.

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
    optimize_node,
    substitute_node,
    confidence_node,
)

# ---------------------------------------------------------------------------
# Build the StateGraph
# ---------------------------------------------------------------------------

_builder = StateGraph(AgentState)

# Register nodes (avoid names that collide with AgentState keys)
_builder.add_node("intent", intent_node)
_builder.add_node("decompose", decompose_node)
_builder.add_node("match", match_node)
_builder.add_node("optimize", optimize_node)
_builder.add_node("substitute", substitute_node)
_builder.add_node("confidence_check", confidence_node)

# Wire edges (linear pipeline)
_builder.set_entry_point("intent")
_builder.add_edge("intent", "decompose")
_builder.add_edge("decompose", "match")
_builder.add_edge("match", "optimize")
_builder.add_edge("optimize", "substitute")
_builder.add_edge("substitute", "confidence_check")
_builder.add_edge("confidence_check", END)

# Compile into a runnable
outcome_graph = _builder.compile()
