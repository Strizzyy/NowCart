"""Services — business logic. Orchestrate agents, repositories and cache.

Modules:
- catalog_service     search, fuzzy match, availability + stock override

Planned modules (later tasks):
- outcome_service     run the LangGraph engine, persist cart, return DTO
- confidence_service  scoring (C2/C3)
- substitution_service swap ranking (D2)
- budget_service      constraint-first selection (A3)
- sos_service         emergency kit templates (D4)
- cart_service        add/remove/update/total (voice follow-ups)
"""
from app.services.catalog_service import CatalogService, get_catalog_service

__all__ = ["CatalogService", "get_catalog_service"]
