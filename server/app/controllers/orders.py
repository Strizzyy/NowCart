"""Orders controller — place orders and retrieve order history.

Routes:
    POST /api/orders/place    -> place an order from the current cart
    GET  /api/orders/{user_id} -> get order history for a user
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.domain.order import Order
from app.repositories import get_repository, get_cache

router = APIRouter(prefix="/api/orders", tags=["orders"])


class PlaceOrderRequest(BaseModel):
    """Request to place an order from the current cart state."""

    session_id: str = Field(..., description="Cart session ID to convert into an order")
    user_id: str = Field(..., description="User placing the order")


class OrderResponse(BaseModel):
    """Response after placing an order."""

    order_id: str
    user_id: str
    order_date: str
    items: list[dict]
    total: float
    status: str


@router.post("/place", response_model=OrderResponse)
async def place_order(req: PlaceOrderRequest) -> OrderResponse:
    """Convert a cart into a persisted order.

    This adds the order to the user's history, enabling the Zero Door
    predictive engine to learn purchase patterns over time.
    """
    cache = get_cache()
    repo = get_repository()

    # Get the cart from cache
    cart = await cache.get_cart(req.session_id)
    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")

    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Build order items from cart
    order_items = [
        {
            "product_id": item.product_id,
            "name": item.name,
            "quantity": item.quantity,
            "price": item.price,
        }
        for item in cart.items
    ]

    # Create the order
    order = Order(
        order_id=f"order-{uuid.uuid4().hex[:8]}",
        user_id=req.user_id,
        order_date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        items=order_items,
        total=cart.total,
        status="delivered",
    )

    # Persist to repository
    await repo.upsert_order(order)

    # Clear the cart after order placement
    await cache.delete_cart(req.session_id)

    return OrderResponse(
        order_id=order.order_id,
        user_id=order.user_id,
        order_date=order.order_date,
        items=order.items,
        total=order.total,
        status=order.status,
    )


@router.get("/{user_id}")
async def get_order_history(user_id: str):
    """Retrieve order history for a user."""
    repo = get_repository()
    orders = await repo.get_orders(user_id)

    return {
        "user_id": user_id,
        "orders": [
            {
                "order_id": o.order_id,
                "order_date": o.order_date,
                "items": o.items,
                "total": o.total,
                "status": o.status,
            }
            for o in orders
        ],
        "count": len(orders),
    }
