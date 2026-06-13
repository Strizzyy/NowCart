"""Wire contracts (DTOs). FastAPI serializes these into the OpenAPI schema
the frontend consumes to generate TS types (Requirement 9.6)."""
from app.models.dto.requests import (
    OutcomeRequest,
    VoiceIntentRequest,
    ConstraintRequest,
    ShareRequest,
    CartOpRequest,
    SosRequest,
    StockOverrideRequest,
)
from app.models.dto.responses import (
    CartResponse,
    CartItemResponse,
    SubstitutionResponse,
    ProductResponse,
    HealthResponse,
    OkResponse,
    ErrorResponse,
)

__all__ = [
    "OutcomeRequest",
    "VoiceIntentRequest",
    "ConstraintRequest",
    "ShareRequest",
    "CartOpRequest",
    "SosRequest",
    "StockOverrideRequest",
    "CartResponse",
    "CartItemResponse",
    "SubstitutionResponse",
    "ProductResponse",
    "HealthResponse",
    "OkResponse",
    "ErrorResponse",
]
