"""Request DTOs — one per front door (controllers validate these)."""
from pydantic import BaseModel, Field


class OutcomeRequest(BaseModel):
    """A1 / generic text outcome."""

    text: str = Field(..., min_length=1, description="e.g. 'I'm making Biryani for 4'")
    servings: int | None = Field(None, ge=1, description="optional serving count for scaling")
    session_id: str | None = None
    user_id: str | None = Field(None, description="user ID for personalized matching")


class VoiceIntentRequest(BaseModel):
    """A2 — a speech transcript routed through the same pipeline as text."""

    transcript: str = Field(..., min_length=1)
    session_id: str | None = None


class ConstraintRequest(BaseModel):
    """A3 — constraint-first ordering."""

    budget: float = Field(..., gt=0, description="budget cap in INR")
    servings: int = Field(..., ge=1)
    text: str | None = Field(None, description="optional outcome hint, e.g. 'dinner'")
    session_id: str | None = None


class ShareRequest(BaseModel):
    """B4 — shared recipe link or pasted recipe text."""

    url: str | None = None
    text: str | None = None
    session_id: str | None = None


class CartOpRequest(BaseModel):
    """Voice/UI follow-up cart operation (A2 follow-ups)."""

    session_id: str = Field("", description="Cart session ID. Empty or missing creates a new cart on 'add'.")
    op: str = Field(..., description="add | remove | update | total")
    entity: str | None = Field(None, description="product name or id the op targets")
    quantity: float | None = None


class SosRequest(BaseModel):
    """D4 — emergency mode."""

    situation: str = Field(..., min_length=1, description="e.g. 'guests in 30 minutes'")
    session_id: str | None = None


class StockOverrideRequest(BaseModel):
    """Demo control to force a product in/out of stock (Requirement 8.3)."""

    product_id: str
    in_stock: bool
