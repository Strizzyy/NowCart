"""Product domain model — grocery catalog (Requirement 8.1)."""
from pydantic import BaseModel, Field


class Product(BaseModel):
    """A single catalog product.

    Fields mirror the seeded grocery dataset plus a few runtime/demo
    attributes (in_stock, delivery_eta_min) controllable via stock override.
    """

    product_id: str
    name: str
    brand: str = ""
    category: str = ""
    sub_category: str = ""
    type: str = ""

    sale_price: float = 0.0
    market_price: float = 0.0
    rating: float | None = None

    unit: str = ""                       # parsed pack unit, e.g. "1 kg", "500 g"
    in_stock: bool = True
    delivery_eta_min: int = 30           # fastest-delivery signal

    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None
    description: str = ""

    # Verified badge fields — computed by BadgeService
    verified: bool = False
    order_count_month: int = 0           # orders in last 30 days (used for badge scoring)

    @property
    def price_per_unit_hint(self) -> float:
        """Cheap proxy for value comparison. Falls back to sale_price."""
        return self.sale_price
