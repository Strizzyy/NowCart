"""Orders controller — place orders and retrieve order history.

Routes:
    POST /api/orders/place            → place an order from the current cart
    POST /api/orders/{order_id}/rate  → rate items in a placed order
    GET  /api/orders/{user_id}        → get order history for a user
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.domain.order import Order
from app.repositories import get_repository, get_cache

router = APIRouter(prefix="/api/orders", tags=["orders"])

_VALID_PAYMENT_METHODS = {"upi", "card", "cod", "wallet"}


class PlaceOrderRequest(BaseModel):
    """Request to place an order from the current cart state."""
    session_id: str = Field(..., description="Cart session ID to convert into an order")
    user_id: str = Field(..., description="User placing the order")
    payment_method: str = Field("cod", description="upi | card | cod | wallet")


class OrderResponse(BaseModel):
    order_id: str
    user_id: str
    order_date: str
    items: list[dict]
    total: float
    status: str
    payment_method: str = "cod"
    payment_status: str = "pending"


class ItemRating(BaseModel):
    product_id: str
    rating: float = Field(..., ge=1.0, le=5.0, description="Rating 1–5")


class RateOrderRequest(BaseModel):
    ratings: list[ItemRating] = Field(..., min_length=1)


@router.post("/place", response_model=OrderResponse)
async def place_order(req: PlaceOrderRequest) -> OrderResponse:
    """Convert a cart into a persisted order with payment method."""
    if req.payment_method not in _VALID_PAYMENT_METHODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment_method. Must be one of: {', '.join(sorted(_VALID_PAYMENT_METHODS))}",
        )

    cache = get_cache()
    repo = get_repository()

    cart = await cache.get_cart(req.session_id)
    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = [
        {
            "product_id": item.product_id,
            "name": item.name,
            "quantity": item.quantity,
            "price": item.price,
        }
        for item in cart.items
    ]

    # Payment status: instant methods are "paid", COD is "pending"
    payment_status = "pending" if req.payment_method == "cod" else "paid"

    order = Order(
        order_id=f"order-{uuid.uuid4().hex[:8]}",
        user_id=req.user_id,
        order_date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        items=order_items,
        total=cart.total,
        status="confirmed",
        payment_method=req.payment_method,
        payment_status=payment_status,
    )

    await repo.upsert_order(order)
    await cache.delete_cart(req.session_id)

    return OrderResponse(
        order_id=order.order_id,
        user_id=order.user_id,
        order_date=order.order_date,
        items=order.items,
        total=order.total,
        status=order.status,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
    )


@router.post("/{order_id}/rate")
async def rate_order_items(order_id: str, req: RateOrderRequest):
    """Rate items from a placed order.

    Updates each product's average rating using an exponential moving average.
    This feeds the NowCart Verified badge score.
    """
    from app.services.badge_service import get_badge_service
    badge_service = get_badge_service()

    results = []
    for item_rating in req.ratings:
        updated = await badge_service.record_item_rating(
            product_id=item_rating.product_id,
            rating=item_rating.rating,
        )
        results.append({
            "product_id": item_rating.product_id,
            "rating": item_rating.rating,
            "updated": updated,
        })

    return {
        "order_id": order_id,
        "ratings_processed": len(results),
        "results": results,
    }


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
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
            }
            for o in orders
        ],
        "count": len(orders),
    }
