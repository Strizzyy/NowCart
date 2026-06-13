"""Order domain model — deterministic mock orders for demo (Requirement 8.2)."""
from pydantic import BaseModel, Field


class Order(BaseModel):
    """A historical order. Seeded deterministically for repeatable demos."""

    order_id: str
    user_id: str
    order_date: str  # ISO date string, e.g. "2024-03-15"
    items: list[dict] = Field(default_factory=list)  # [{product_id, name, quantity, price}]
    total: float = 0.0
    status: str = "delivered"
