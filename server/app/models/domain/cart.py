"""Cart domain models — the confident, ready-to-checkout result of the engine."""
from pydantic import BaseModel, Field

from app.models.domain.enums import IntentMode


class Substitution(BaseModel):
    """Record of an out-of-stock swap — always traceable (Requirement 6.2)."""

    original_product_id: str
    original_name: str
    substitute_product_id: str
    substitute_name: str
    reason: str


class CartItem(BaseModel):
    """A single line in the cart."""

    product_id: str
    name: str
    brand: str = ""
    price: float = 0.0
    quantity: float = 1.0
    unit: str = ""
    reason: str = ""                       # single-line "why this one" (C2)
    confidence: float = 1.0                # 0..1 (C3)
    substituted_for: str | None = None     # original product_id if swapped (D2)

    @property
    def line_total(self) -> float:
        return round(self.price * self.quantity, 2)


class Cart(BaseModel):
    """The assembled cart returned by the Outcome Engine (Requirement 1.4)."""

    session_id: str
    items: list[CartItem] = Field(default_factory=list)
    total: float = 0.0
    currency: str = "INR"
    mode: IntentMode = IntentMode.TEXT
    confidence: float = 1.0
    substitutions: list[Substitution] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)      # unmatched needs, degraded flags, etc.
    clarification: str | None = None                    # HITL question (C3)
    budget: float | None = None                         # A3
    remaining_budget: float | None = None               # A3 (3.4)
    shortfall: float | None = None                      # A3 (3.2)
    degraded: bool = False                              # graceful degradation flag

    def recompute_total(self) -> float:
        """Sum line totals into `total`. Keeps the invariant in one place."""
        self.total = round(sum(item.line_total for item in self.items), 2)
        if self.budget is not None:
            self.remaining_budget = round(self.budget - self.total, 2)
        return self.total
