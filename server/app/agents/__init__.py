"""Agents — the LangGraph Outcome Engine (Requirement 1.6).

Modules:
- state    AgentState TypedDict (raw_input, mode, needs, candidates, cart, ...)
- nodes    intent → decompose → match → optimize → substitute → confidence
- graph    wiring with the out-of-stock conditional edge + HITL gate (task 4.2)
"""
from app.agents.state import AgentState
from app.agents.nodes import (
    intent_node,
    decompose_node,
    match_node,
    optimize_node,
    substitute_node,
    confidence_node,
)
from app.agents.graph import outcome_graph

__all__ = [
    "AgentState",
    "intent_node",
    "decompose_node",
    "match_node",
    "optimize_node",
    "substitute_node",
    "confidence_node",
    "outcome_graph",
]
