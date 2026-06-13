"""Services — business logic. Orchestrate agents, repositories and cache.

Modules:
- catalog_service     search, fuzzy match, availability + stock override
- outcome_service     run the LangGraph engine, persist cart, return domain model
"""
from app.services.catalog_service import CatalogService, get_catalog_service


def __getattr__(name: str):  # noqa: N807
    """Lazy-load OutcomeService to avoid circular imports with agents.graph."""
    if name == "OutcomeService":
        from app.services.outcome_service import OutcomeService
        return OutcomeService
    if name == "get_outcome_service":
        from app.services.outcome_service import get_outcome_service
        return get_outcome_service
    raise AttributeError(f"module 'app.services' has no attribute {name!r}")


__all__ = [
    "CatalogService",
    "get_catalog_service",
    "OutcomeService",
    "get_outcome_service",
]
