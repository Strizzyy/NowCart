"""Internal domain models — the language the services and agents speak.

These are the source of truth for business logic. DTOs (in app.models.dto)
are the wire contracts derived from / mapped to these.
"""
from app.models.domain.enums import IntentMode, NeedStatus
from app.models.domain.product import Product
from app.models.domain.need import Need
from app.models.domain.cart import Cart, CartItem, Substitution

__all__ = [
    "IntentMode",
    "NeedStatus",
    "Product",
    "Need",
    "Cart",
    "CartItem",
    "Substitution",
]
