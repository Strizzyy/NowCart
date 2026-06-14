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
        # Rahul user (matches the user created by the developer: rahul@gmail.com)
        User(
            user_id="rahul",
            name="Rahul",
            email="rahul@gmail.com",
            preferences=["north-indian", "high-protein", "quick-meals"],
        ),
    ]


def create_mock_orders(product_ids: list[str]) -> list[Order]:
    """Return deterministic mock orders referencing real product IDs from the catalog.

    Orders use RECENT dates (relative to today) so the predictive Zero Door
    can detect depletion patterns. Products repeat across multiple orders to
    enable inter-purchase interval analysis.

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
        # ==============================
        # Rahul's orders (user "rahul" — rahul@gmail.com)
        # Multiple orders with REPEATING products + recent dates for Zero Door to work
        # ==============================
        Order(
            order_id="order-rahul-001",
            user_id="rahul",
            order_date=_recent_date(2),  # 2 days ago
            items=[
                {"product_id": _pid(0), "name": "Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
                {"product_id": _pid(60), "name": "Eggs", "quantity": 1, "price": 85.0},
                {"product_id": _pid(90), "name": "Milk", "quantity": 2, "price": 65.0},
            ],
            total=795.0,
            status="delivered",
        ),
        Order(
            order_id="order-rahul-002",
            user_id="rahul",
            order_date=_recent_date(9),  # 9 days ago
            items=[
                {"product_id": _pid(0), "name": "Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(60), "name": "Eggs", "quantity": 1, "price": 85.0},
                {"product_id": _pid(90), "name": "Milk", "quantity": 2, "price": 65.0},
                {"product_id": _pid(50), "name": "Chicken", "quantity": 1, "price": 350.0},
            ],
            total=995.0,
            status="delivered",
        ),
        Order(
            order_id="order-rahul-003",
            user_id="rahul",
            order_date=_recent_date(16),  # 16 days ago
            items=[
                {"product_id": _pid(0), "name": "Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
                {"product_id": _pid(60), "name": "Eggs", "quantity": 1, "price": 85.0},
                {"product_id": _pid(90), "name": "Milk", "quantity": 2, "price": 65.0},
                {"product_id": _pid(70), "name": "Peanut Butter", "quantity": 1, "price": 280.0},
            ],
            total=1075.0,
            status="delivered",
        ),
        Order(
            order_id="order-rahul-004",
            user_id="rahul",
            order_date=_recent_date(23),  # 23 days ago
            items=[
                {"product_id": _pid(0), "name": "Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(60), "name": "Eggs", "quantity": 1, "price": 85.0},
                {"product_id": _pid(90), "name": "Milk", "quantity": 2, "price": 65.0},
                {"product_id": _pid(50), "name": "Chicken", "quantity": 1, "price": 350.0},
                {"product_id": _pid(80), "name": "Protein Bar", "quantity": 2, "price": 60.0},
            ],
            total=1055.0,
            status="delivered",
        ),
        Order(
            order_id="order-rahul-005",
            user_id="rahul",
            order_date=_recent_date(30),  # 30 days ago
            items=[
                {"product_id": _pid(0), "name": "Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
                {"product_id": _pid(60), "name": "Eggs", "quantity": 1, "price": 85.0},
                {"product_id": _pid(90), "name": "Milk", "quantity": 2, "price": 65.0},
            ],
            total=795.0,
            status="delivered",
        ),

        # ==============================
        # Priya's orders (user-001) — also with repeating products and recent dates
        # ==============================
        Order(
            order_id="order-001",
            user_id="user-001",
            order_date=_recent_date(3),
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
            order_date=_recent_date(10),
            items=[
                {"product_id": _pid(0), "name": "Organic Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Green Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(30), "name": "Oats", "quantity": 1, "price": 120.0},
                {"product_id": _pid(40), "name": "Honey", "quantity": 1, "price": 320.0},
            ],
            total=870.0,
            status="delivered",
        ),
        Order(
            order_id="order-002b",
            user_id="user-001",
            order_date=_recent_date(17),
            items=[
                {"product_id": _pid(0), "name": "Organic Rice", "quantity": 2, "price": 180.0},
                {"product_id": _pid(10), "name": "Green Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
                {"product_id": _pid(30), "name": "Oats", "quantity": 1, "price": 120.0},
            ],
            total=880.0,
            status="delivered",
        ),
        Order(
            order_id="order-002c",
            user_id="user-001",
            order_date=_recent_date(24),
            items=[
                {"product_id": _pid(0), "name": "Organic Rice", "quantity": 1, "price": 180.0},
                {"product_id": _pid(10), "name": "Green Tea", "quantity": 1, "price": 250.0},
                {"product_id": _pid(20), "name": "Coconut Oil", "quantity": 1, "price": 150.0},
            ],
            total=580.0,
            status="delivered",
        ),

        # ==============================
        # Rahul Mehta's orders (user-002) — repeating products, recent dates
        # ==============================
        Order(
            order_id="order-003",
            user_id="user-002",
            order_date=_recent_date(4),
            items=[
                {"product_id": _pid(50), "name": "Chicken Breast", "quantity": 2, "price": 350.0},
                {"product_id": _pid(60), "name": "Eggs (12 pack)", "quantity": 1, "price": 85.0},
                {"product_id": _pid(70), "name": "Peanut Butter", "quantity": 1, "price": 280.0},
                {"product_id": _pid(90), "name": "Milk 1L", "quantity": 2, "price": 65.0},
            ],
            total=1195.0,
            status="delivered",
        ),
        Order(
            order_id="order-004",
            user_id="user-002",
            order_date=_recent_date(11),
            items=[
                {"product_id": _pid(50), "name": "Chicken Breast", "quantity": 1, "price": 350.0},
                {"product_id": _pid(60), "name": "Eggs (12 pack)", "quantity": 1, "price": 85.0},
                {"product_id": _pid(80), "name": "Protein Bar", "quantity": 4, "price": 60.0},
                {"product_id": _pid(90), "name": "Milk 1L", "quantity": 2, "price": 65.0},
            ],
            total=740.0,
            status="delivered",
        ),
        Order(
            order_id="order-004b",
            user_id="user-002",
            order_date=_recent_date(18),
            items=[
                {"product_id": _pid(50), "name": "Chicken Breast", "quantity": 2, "price": 350.0},
                {"product_id": _pid(60), "name": "Eggs (12 pack)", "quantity": 1, "price": 85.0},
                {"product_id": _pid(70), "name": "Peanut Butter", "quantity": 1, "price": 280.0},
                {"product_id": _pid(90), "name": "Milk 1L", "quantity": 2, "price": 65.0},
            ],
            total=1195.0,
            status="delivered",
        ),

        # ==============================
        # Anita's orders (user-003) — repeating products, recent dates
        # ==============================
        Order(
            order_id="order-005",
            user_id="user-003",
            order_date=_recent_date(5),
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
            order_date=_recent_date(12),
            items=[
                {"product_id": _pid(100), "name": "Almond Milk", "quantity": 1, "price": 220.0},
                {"product_id": _pid(110), "name": "Quinoa", "quantity": 1, "price": 350.0},
                {"product_id": _pid(120), "name": "Gluten-Free Pasta", "quantity": 1, "price": 190.0},
                {"product_id": _pid(130), "name": "Dark Chocolate", "quantity": 2, "price": 150.0},
            ],
            total=1080.0,
            status="delivered",
        ),
        Order(
            order_id="order-006b",
            user_id="user-003",
            order_date=_recent_date(19),
            items=[
                {"product_id": _pid(100), "name": "Almond Milk", "quantity": 2, "price": 220.0},
                {"product_id": _pid(110), "name": "Quinoa", "quantity": 1, "price": 350.0},
            ],
            total=790.0,
            status="delivered",
        ),

        # ==============================
        # Vikram's orders (user-004) — repeating products, recent dates
        # ==============================
        Order(
            order_id="order-007",
            user_id="user-004",
            order_date=_recent_date(3),
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
            order_date=_recent_date(10),
            items=[
                {"product_id": _pid(140), "name": "Rice 5kg", "quantity": 1, "price": 450.0},
                {"product_id": _pid(150), "name": "Cooking Oil 5L", "quantity": 1, "price": 680.0},
                {"product_id": _pid(180), "name": "Juice Pack (6)", "quantity": 2, "price": 180.0},
                {"product_id": _pid(190), "name": "Biscuits Combo", "quantity": 1, "price": 150.0},
            ],
            total=1640.0,
            status="delivered",
        ),
        Order(
            order_id="order-008b",
            user_id="user-004",
            order_date=_recent_date(17),
            items=[
                {"product_id": _pid(140), "name": "Rice 5kg", "quantity": 1, "price": 450.0},
                {"product_id": _pid(150), "name": "Cooking Oil 5L", "quantity": 1, "price": 680.0},
                {"product_id": _pid(160), "name": "Sugar 2kg", "quantity": 1, "price": 90.0},
                {"product_id": _pid(170), "name": "Tea Powder 500g", "quantity": 1, "price": 210.0},
            ],
            total=1430.0,
            status="delivered",
        ),
    ]
