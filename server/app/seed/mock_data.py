"""Deterministic mock users and orders for repeatable demos (Requirement 8.2).

All data is fixed (no randomness) so every run produces identical state.
This enables predictable demo flows and consistent testing.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.models.domain import User, Order


def _recent_date(days_ago: int) -> str:
    """Return an ISO date string for `days_ago` days before today."""
    return (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def create_mock_users() -> list[User]:
    """Return deterministic mock users for demo sessions."""
    return [
        User(user_id="user-001", name="Priya Sharma", email="priya@example.com",
             preferences=["organic", "low-sugar", "south-indian"]),
        User(user_id="user-002", name="Rahul Mehta", email="rahul@example.com",
             preferences=["high-protein", "quick-meals", "north-indian"]),
        User(user_id="user-003", name="Anita Desai", email="anita@example.com",
             preferences=["vegan", "gluten-free", "snacks"]),
        User(user_id="user-004", name="Vikram Patel", email="vikram@example.com",
             preferences=["budget-friendly", "family-pack", "beverages"]),
        User(user_id="user-005", name="Demo User", email="demo@example.com", preferences=[]),
        User(user_id="admin", name="Admin", email="admin@nowcart.app", preferences=[]),
        User(user_id="rahul", name="Rahul", email="rahul@gmail.com",
             preferences=["north-indian", "high-protein", "quick-meals"]),
    ]


def create_mock_orders(product_ids: list[str]) -> list[Order]:
    """Return deterministic mock orders referencing real product IDs from the catalog.

    Uses name-based lookup against the CSV catalog so the correct product_id is
    always resolved regardless of DynamoDB scan order (which is non-deterministic).

    The old index-based _pid(idx) approach broke on DynamoDB because a table scan
    returns rows in arbitrary order — causing random products like "Bravura Clipper
    ₹12500" (a hair clipper) to appear in grocery restock predictions.
    """
    from app.seed.catalog import load_catalog
    catalog_products = load_catalog()

    # Build name (lowercase) → product_id index from the CSV — stable ordering
    name_index: dict[str, str] = {p.name.lower(): p.product_id for p in catalog_products}

    # search_key → (display_name, price)
    items_cfg: dict[str, tuple[str, float]] = {
        "rice":           ("Rice", 180.0),
        "tea":            ("Tea", 250.0),
        "coconut oil":    ("Coconut Oil", 150.0),
        "eggs":           ("Eggs", 85.0),
        "milk":           ("Milk", 65.0),
        "chicken":        ("Chicken", 350.0),
        "peanut butter":  ("Peanut Butter", 280.0),
        "protein bar":    ("Protein Bar", 60.0),
        "oats":           ("Oats", 120.0),
        "honey":          ("Honey", 320.0),
        "almond milk":    ("Almond Milk", 220.0),
        "quinoa":         ("Quinoa", 350.0),
        "pasta":          ("Pasta", 190.0),
        "dark chocolate": ("Dark Chocolate", 150.0),
        "sugar":          ("Sugar", 90.0),
        "cooking oil":    ("Cooking Oil", 680.0),
        "juice":          ("Juice", 180.0),
        "biscuits":       ("Biscuits", 150.0),
    }

    def _pid(key: str) -> str:
        """Resolve product_id by name; partial match if exact not found."""
        pid = name_index.get(key.lower())
        if pid:
            return pid
        for catalog_name, cid in name_index.items():
            if key.lower() in catalog_name:
                return cid
        return catalog_products[0].product_id if catalog_products else f"product-{key}"

    def _item(key: str, qty: int = 1) -> dict:
        display, price = items_cfg.get(key, (key.title(), 100.0))
        return {"product_id": _pid(key), "name": display, "quantity": qty, "price": price}

    return [
        # Rahul's orders (user "rahul" — rahul@gmail.com)
        Order(order_id="order-rahul-001", user_id="rahul", order_date=_recent_date(2),
              items=[_item("rice"), _item("tea"), _item("coconut oil"), _item("eggs"), _item("milk", 2)],
              total=795.0, status="delivered"),
        Order(order_id="order-rahul-002", user_id="rahul", order_date=_recent_date(9),
              items=[_item("rice"), _item("tea"), _item("eggs"), _item("milk", 2), _item("chicken")],
              total=995.0, status="delivered"),
        Order(order_id="order-rahul-003", user_id="rahul", order_date=_recent_date(16),
              items=[_item("rice"), _item("tea"), _item("coconut oil"), _item("eggs"), _item("milk", 2), _item("peanut butter")],
              total=1075.0, status="delivered"),
        Order(order_id="order-rahul-004", user_id="rahul", order_date=_recent_date(23),
              items=[_item("rice"), _item("tea"), _item("eggs"), _item("milk", 2), _item("chicken"), _item("protein bar", 2)],
              total=1055.0, status="delivered"),
        Order(order_id="order-rahul-005", user_id="rahul", order_date=_recent_date(30),
              items=[_item("rice"), _item("tea"), _item("coconut oil"), _item("eggs"), _item("milk", 2)],
              total=795.0, status="delivered"),

        # Priya's orders (user-001)
        Order(order_id="order-001", user_id="user-001", order_date=_recent_date(3),
              items=[_item("rice", 2), _item("tea"), _item("coconut oil")],
              total=760.0, status="delivered"),
        Order(order_id="order-002", user_id="user-001", order_date=_recent_date(10),
              items=[_item("rice"), _item("tea"), _item("oats"), _item("honey")],
              total=870.0, status="delivered"),
        Order(order_id="order-002b", user_id="user-001", order_date=_recent_date(17),
              items=[_item("rice", 2), _item("tea"), _item("coconut oil"), _item("oats")],
              total=880.0, status="delivered"),
        Order(order_id="order-002c", user_id="user-001", order_date=_recent_date(24),
              items=[_item("rice"), _item("tea"), _item("coconut oil")],
              total=580.0, status="delivered"),

        # Rahul Mehta's orders (user-002)
        Order(order_id="order-003", user_id="user-002", order_date=_recent_date(4),
              items=[_item("chicken", 2), _item("eggs"), _item("peanut butter"), _item("milk", 2)],
              total=1195.0, status="delivered"),
        Order(order_id="order-004", user_id="user-002", order_date=_recent_date(11),
              items=[_item("chicken"), _item("eggs"), _item("protein bar", 4), _item("milk", 2)],
              total=740.0, status="delivered"),
        Order(order_id="order-004b", user_id="user-002", order_date=_recent_date(18),
              items=[_item("chicken", 2), _item("eggs"), _item("peanut butter"), _item("milk", 2)],
              total=1195.0, status="delivered"),

        # Anita's orders (user-003)
        Order(order_id="order-005", user_id="user-003", order_date=_recent_date(5),
              items=[_item("almond milk", 2), _item("quinoa")],
              total=790.0, status="delivered"),
        Order(order_id="order-006", user_id="user-003", order_date=_recent_date(12),
              items=[_item("almond milk"), _item("quinoa"), _item("pasta"), _item("dark chocolate", 2)],
              total=1080.0, status="delivered"),
        Order(order_id="order-006b", user_id="user-003", order_date=_recent_date(19),
              items=[_item("almond milk", 2), _item("quinoa")],
              total=790.0, status="delivered"),

        # Vikram's orders (user-004)
        Order(order_id="order-007", user_id="user-004", order_date=_recent_date(3),
              items=[_item("rice"), _item("cooking oil"), _item("sugar"), _item("tea")],
              total=1430.0, status="delivered"),
        Order(order_id="order-008", user_id="user-004", order_date=_recent_date(10),
              items=[_item("rice"), _item("cooking oil"), _item("juice", 2), _item("biscuits")],
              total=1640.0, status="delivered"),
        Order(order_id="order-008b", user_id="user-004", order_date=_recent_date(17),
              items=[_item("rice"), _item("cooking oil"), _item("sugar"), _item("tea")],
              total=1430.0, status="delivered"),
    ]
