"""Response DTOs + mappers from domain models.

Keeping a thin DTO layer (rather than returning domain models directly) means
the wire contract can evolve independently of internal models, and the OpenAPI
schema stays stable for the generated TS client (Requirement 9.6).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.domain.cart import Cart, CartItem, Substitution
from app.models.domain.product import Product


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "nowcart"
    version: str = "0.1.0"


class OkResponse(BaseModel):
    ok: bool = True
    message: str = ""


class ErrorResponse(BaseModel):
    """Consistent error envelope wrapped by controllers."""

    error: str
    detail: str | None = None
    request_id: str | None = None


class ProductResponse(BaseModel):
    product_id: str
    name: str
    brand: str = ""
    category: str = ""
    sub_category: str = ""
    sale_price: float = 0.0
    market_price: float = 0.0
    rating: float | None = None
    unit: str = ""
    in_stock: bool = True
    delivery_eta_min: int = 30
    image_url: str | None = None
    description: str = ""

    @classmethod
    def from_domain(cls, p: Product) -> "ProductResponse":
        return cls(
            product_id=p.product_id,
            name=p.name,
            brand=p.brand,
            category=p.category,
            sub_category=p.sub_category,
            sale_price=p.sale_price,
            market_price=p.market_price,
            rating=p.rating,
            unit=p.unit,
            in_stock=p.in_stock,
            delivery_eta_min=p.delivery_eta_min,
            image_url=p.image_url,
            description=p.description,
        )


class SubstitutionResponse(BaseModel):
    original_product_id: str
    original_name: str
    substitute_product_id: str
    substitute_name: str
    reason: str

    @classmethod
    def from_domain(cls, s: Substitution) -> "SubstitutionResponse":
        return cls(**s.model_dump())


class CartItemResponse(BaseModel):
    product_id: str
    name: str
    brand: str = ""
    price: float = 0.0
    quantity: float = 1.0
    unit: str = ""
    line_total: float = 0.0
    reason: str = ""
    confidence: float = 1.0
    substituted_for: str | None = None
    image_url: str | None = None

    @classmethod
    def from_domain(cls, item: CartItem) -> "CartItemResponse":
        return cls(
            product_id=item.product_id,
            name=item.name,
            brand=item.brand,
            price=item.price,
            quantity=item.quantity,
            unit=item.unit,
            line_total=item.line_total,
            reason=item.reason,
            confidence=item.confidence,
            substituted_for=item.substituted_for,
            image_url=item.image_url,
        )


class CartResponse(BaseModel):
    """The primary response shape returned by every front door."""

    session_id: str
    items: list[CartItemResponse] = Field(default_factory=list)
    total: float = 0.0
    currency: str = "INR"
    mode: str = "text"
    confidence: float = 1.0
    substitutions: list[SubstitutionResponse] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    clarification: str | None = None
    reasoning_trail: list[str] = Field(default_factory=list)
    budget: float | None = None
    remaining_budget: float | None = None
    shortfall: float | None = None
    eta_minutes: int | None = None
    degraded: bool = False

    @classmethod
    def from_domain(cls, cart: Cart) -> "CartResponse":
        return cls(
            session_id=cart.session_id,
            items=[CartItemResponse.from_domain(i) for i in cart.items],
            total=cart.total,
            currency=cart.currency,
            mode=cart.mode.value,
            confidence=cart.confidence,
            substitutions=[SubstitutionResponse.from_domain(s) for s in cart.substitutions],
            notes=cart.notes,
            clarification=cart.clarification,
            reasoning_trail=cart.reasoning_trail,
            budget=cart.budget,
            remaining_budget=cart.remaining_budget,
            shortfall=cart.shortfall,
            eta_minutes=cart.eta_minutes,
            degraded=cart.degraded,
        )
