"""Repository protocol — abstract data-access interface (Requirement 8.4, 9.1).

All backends (in-memory, DynamoDB) implement this protocol so services are
storage-agnostic.
"""
from typing import Protocol, runtime_checkable

from app.models.domain import Product, User, Order


@runtime_checkable
class Repository(Protocol):
    """Async data-access contract for products, users, and orders."""

    # --- Products ---

    async def get_product(self, product_id: str) -> Product | None:
        """Return a single product by ID, or None if not found."""
        ...

    async def list_products(
        self,
        category: str | None = None,
        search: str | None = None,
    ) -> list[Product]:
        """List products, optionally filtered by category or search term."""
        ...

    async def upsert_product(self, product: Product) -> None:
        """Insert or update a single product."""
        ...

    async def bulk_upsert_products(self, products: list[Product]) -> None:
        """Insert or update many products at once (for seeding)."""
        ...

    # --- Users ---

    async def get_user(self, user_id: str) -> User | None:
        """Return a user by ID, or None."""
        ...

    async def upsert_user(self, user: User) -> None:
        """Insert or update a user."""
        ...

    # --- Orders ---

    async def get_orders(self, user_id: str) -> list[Order]:
        """Return all orders for a given user, newest first."""
        ...

    async def upsert_order(self, order: Order) -> None:
        """Insert or update an order."""
        ...
