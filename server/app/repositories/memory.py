"""In-memory repository — default backend, zero external deps (Requirement 8.4).

Stores everything in plain dicts. The app always runs with this backend so
no AWS/DynamoDB/Redis is needed for local dev or demos.
"""
from app.models.domain import Product, User, Order


class MemoryRepository:
    """Dict-backed implementation of the Repository protocol."""

    def __init__(self) -> None:
        self._products: dict[str, Product] = {}
        self._users: dict[str, User] = {}
        self._orders: dict[str, list[Order]] = {}  # keyed by user_id

    # --- Products ---

    async def get_product(self, product_id: str) -> Product | None:
        return self._products.get(product_id)

    async def list_products(
        self,
        category: str | None = None,
        search: str | None = None,
    ) -> list[Product]:
        results = list(self._products.values())

        if category:
            cat_lower = category.lower()
            results = [p for p in results if p.category.lower() == cat_lower]

        if search:
            term = search.lower()
            results = [
                p for p in results
                if term in p.name.lower()
                or term in p.category.lower()
                or term in p.brand.lower()
                or term in p.sub_category.lower()
            ]

        return results

    async def upsert_product(self, product: Product) -> None:
        self._products[product.product_id] = product

    async def bulk_upsert_products(self, products: list[Product]) -> None:
        for product in products:
            self._products[product.product_id] = product

    # --- Users ---

    async def get_user(self, user_id: str) -> User | None:
        return self._users.get(user_id)

    async def upsert_user(self, user: User) -> None:
        self._users[user.user_id] = user

    # --- Orders ---

    async def get_orders(self, user_id: str) -> list[Order]:
        orders = self._orders.get(user_id, [])
        return sorted(orders, key=lambda o: o.order_date, reverse=True)

    async def upsert_order(self, order: Order) -> None:
        if order.user_id not in self._orders:
            self._orders[order.user_id] = []

        # Replace if same order_id exists, else append
        existing = self._orders[order.user_id]
        for i, o in enumerate(existing):
            if o.order_id == order.order_id:
                existing[i] = order
                return
        existing.append(order)
