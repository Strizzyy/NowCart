"""Deterministic mock users and orders for repeatable demos (Requirement 8.2).

All data is fixed (no randomness) so every run produces identical state.
This enables predictable demo flows and consistent testing.
"""
from __future__ import annotations

from app.models.domain import User, Order


def create_mock_users() -> list[User]:
    """Return deterministic mock users for demo sessions."""
    return [
        User(
            user_id="user-001",
            name="Priya Sharma",
            email="priya@example.com",
            preferences=["organic", "low-sugar", "south-indian"],
        ),
        User(
            user_id="user-002",
            name="Rahul Mehta",
            email="rahul@example.com",
            preferences=["high-protein", "quick-meals", "north-indian"],
        ),
        User(
            user_id="user-003",
            name="Anita Desai",
            email="anita@example.com",
            preferences=["vegan", "gluten-free", "snacks"],
        ),
        User(
            user_id="user-004",
            name="Vikram Patel",
            email="vikram@example.com",
            preferences=["budget-friendly", "family-pack", "beverages"],
        ),
        User(
            user_id="user-005",
            name="Demo User",
            email="demo@example.com",
            preferences=[],
        ),
    ]


def create_mock_orders(product_ids: list[str]) -> list[Order]:
    """Return deterministic mock orders referencing real product IDs from the catalog.

    Args:
        product_ids: List of product IDs from the loaded catalog.
                     Used to create realistic order items.

    Returns:
        List of Order instances tied to mock users.
    """
    # Use fixed product_id slots from the catalog (safe indexing)
    def _pid(idx: int) -> str:
        return product_ids[idx % len(product_ids)] if product_ids else f"product-{idx}"

    return [
        # Priya's orders
        Order(
            order_id="order-001",
            user_id="user-001",
            order_date="2024-03-10",
            items=[
                {"product_id": _pid(0), "name": "Organic Rice", "quantity": 2, "price": 180.0},
                {"product_id": _pid(10), "name": "Green Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
            ],
            total=760.0,
            status="delivered",
        ),
        Order(
            order_id="order-002",
            user_id="user-001",
            order_date="2024-03-05",
            items=[
                {"product_id": _pid(30), "name": "Oats", "quantity": 1, "price": 120.0},
                {"product_id": _pid(40), "name": "Honey", "quantity": 1, "price": 320.0},
            ],
            total=440.0,
            status="delivered",
        ),
        # Rahul's orders
        Order(
            order_id="order-003",
            user_id="user-002",
            order_date="2024-03-12",
            items=[
                {"product_id": _pid(50), "name": "Chicken Breast", "quantity": 2, "price": 350.0},
                {"product_id": _pid(60), "name": "Eggs (12 pack)", "quantity": 1, "price": 85.0},
                {"product_id": _pid(70), "name": "Peanut Butter", "quantity": 1, "price": 280.0},
            ],
            total=1065.0,
            status="delivered",
        ),
        Order(
            order_id="order-004",
            user_id="user-002",
            order_date="2024-02-28",
            items=[
                {"product_id": _pid(80), "name": "Protein Bar", "quantity": 4, "price": 60.0},
                {"product_id": _pid(90), "name": "Milk 1L", "quantity": 2, "price": 65.0},
            ],
            total=370.0,
            status="delivered",
        ),
        # Anita's orders
        Order(
            order_id="order-005",
            user_id="user-003",
            order_date="2024-03-08",
            items=[
                {"product_id": _pid(100), "name": "Almond Milk", "quantity": 2, "price": 220.0},
                {"product_id": _pid(110), "name": "Quinoa", "quantity": 1, "price": 350.0},
            ],
            total=790.0,
            status="delivered",
        ),
        Order(
            order_id="order-006",
            user_id="user-003",
            order_date="2024-03-01",
            items=[
                {"product_id": _pid(120), "name": "Gluten-Free Pasta", "quantity": 1, "price": 190.0},
                {"product_id": _pid(130), "name": "Dark Chocolate", "quantity": 2, "price": 150.0},
            ],
            total=490.0,
            status="delivered",
        ),
        # Vikram's orders
        Order(
            order_id="order-007",
            user_id="user-004",
            order_date="2024-03-14",
            items=[
                {"product_id": _pid(140), "name": "Rice 5kg", "quantity": 1, "price": 450.0},
                {"product_id": _pid(150), "name": "Cooking Oil 5L", "quantity": 1, "price": 680.0},
                {"product_id": _pid(160), "name": "Sugar 2kg", "quantity": 1, "price": 90.0},
                {"product_id": _pid(170), "name": "Tea Powder 500g", "quantity": 1, "price": 210.0},
            ],
            total=1430.0,
            status="delivered",
        ),
        Order(
            order_id="order-008",
            user_id="user-004",
            order_date="2024-02-20",
            items=[
                {"product_id": _pid(180), "name": "Juice Pack (6)", "quantity": 2, "price": 180.0},
                {"product_id": _pid(190), "name": "Biscuits Combo", "quantity": 1, "price": 150.0},
            ],
            total=510.0,
            status="delivered",
        ),
    ]
