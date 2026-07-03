"""Subscribe controller — predicted restock + recurring schedules.

Routes (predicted restock):
    GET  /api/subscribe/{user_id}              → predicted restock cart
    GET  /api/subscribe/{user_id}/insights     → raw prediction insights

Routes (recurring schedules):
    POST   /api/subscribe                      → add/update a recurring subscription
    DELETE /api/subscribe/{user_id}/{product_id} → remove a subscription
    GET    /api/subscribe/{user_id}/schedules  → all subscriptions for a user
    GET    /api/subscribe/{user_id}/due        → subscriptions due today (for cart pre-population)

Other routes kept from predict.py:
    GET  /api/preferences/{user_id}   → user preference profile
    GET  /api/pantry/{user_id}        → recently-ordered items
    POST /api/replan                  → re-plan cart with feedback
    POST /api/counterfactuals         → 'why not' for a cart item
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.dto.responses import CartResponse
from app.services.subscribe_service import get_subscribe_service
from app.services.preference_service import get_preference_service
from app.services.pantry_service import get_pantry_service
from app.services.outcome_service import get_outcome_service
from app.services.counterfactual_service import get_counterfactual_service

router = APIRouter(prefix="/api", tags=["subscribe"])


# ---------------------------------------------------------------------------
# Request DTOs
# ---------------------------------------------------------------------------

class ReplanRequest(BaseModel):
    text: str = Field(..., min_length=1)
    feedback: str = Field(..., min_length=1)
    user_id: str | None = None
    servings: int | None = None


class CounterfactualRequest(BaseModel):
    need_name: str
    selected_product_id: str
    candidates: list[list]
    user_id: str | None = None


class SubscriptionRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    frequency: str = Field(..., pattern="^(daily|weekly|monthly)$")


# ---------------------------------------------------------------------------
# Predicted restock
# ---------------------------------------------------------------------------

@router.get("/subscribe/{user_id}")
async def get_predicted_cart(user_id: str):
    """Subscribe — get a pre-staged restock cart based on purchase patterns."""
    service = get_subscribe_service()
    cart = await service.predict_restock(user_id)

    if cart is None:
        return {
            "message": "Not enough order history for predictions yet. Keep shopping!",
            "predictions": [],
            "cart": None,
        }

    return {
        "message": f"🔮 We predicted {len(cart.items)} items you might need",
        "cart": CartResponse.from_domain(cart).model_dump(),
    }


@router.get("/subscribe/{user_id}/insights")
async def get_prediction_insights(user_id: str):
    """Get raw prediction insights without building a cart."""
    service = get_subscribe_service()
    insights = await service.get_prediction_insights(user_id)
    return {"user_id": user_id, "predictions": insights, "count": len(insights)}


# ---------------------------------------------------------------------------
# Recurring schedules
# ---------------------------------------------------------------------------

@router.post("/subscribe")
async def add_subscription(req: SubscriptionRequest):
    """Add or update a recurring subscription for a product."""
    service = get_subscribe_service()
    sub = await service.add_subscription(
        user_id=req.user_id,
        product_id=req.product_id,
        product_name=req.product_name,
        frequency=req.frequency,
    )
    return {"message": "Subscription saved", "subscription": sub}


@router.delete("/subscribe/{user_id}/{product_id}")
async def remove_subscription(user_id: str, product_id: str):
    """Remove a recurring subscription."""
    service = get_subscribe_service()
    removed = await service.remove_subscription(user_id, product_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription removed"}


@router.get("/subscribe/{user_id}/schedules")
async def get_subscriptions(user_id: str):
    """Get all recurring subscriptions for a user."""
    service = get_subscribe_service()
    subs = await service.get_subscriptions(user_id)
    return {"user_id": user_id, "subscriptions": subs, "count": len(subs)}


@router.get("/subscribe/{user_id}/due")
async def get_due_subscriptions(user_id: str):
    """Get subscriptions due today and a pre-built cart from them."""
    service = get_subscribe_service()
    due = await service.get_due_subscriptions(user_id)
    cart = await service.build_due_cart(user_id) if due else None

    return {
        "user_id": user_id,
        "due_count": len(due),
        "due": due,
        "cart": CartResponse.from_domain(cart).model_dump() if cart else None,
    }


# ---------------------------------------------------------------------------
# Preferences, pantry (recently ordered), replan, counterfactuals
# ---------------------------------------------------------------------------

@router.get("/preferences/{user_id}")
async def get_user_preferences(user_id: str):
    """Get the computed preference profile for a user."""
    service = get_preference_service()
    preference = await service.get_user_preference(user_id)
    if preference is None:
        return {"message": "No order history found — preferences not yet available.", "preference": None}
    return {"message": f"Preference profile computed from {preference.total_orders} orders", "preference": preference.model_dump()}


@router.get("/pantry/{user_id}")
async def get_recently_ordered(user_id: str):
    """Get products the user ordered in the last 30 days (recently-ordered prompt data)."""
    service = get_pantry_service()
    # Return raw recently-ordered data — no specific product_ids to filter against here
    # so we scan last 5 orders and return what was found
    from app.repositories import get_repository
    repo = get_repository()
    orders = await repo.get_orders(user_id)

    product_ids_seen: list[str] = []
    for order in orders[:5]:
        for item in order.items:
            pid = item.get("product_id", "")
            if pid and pid not in product_ids_seen:
                product_ids_seen.append(pid)

    recently = await service.get_recently_ordered(user_id, product_ids_seen)
    items = [{"product_id": pid, "days_ago": days} for pid, days in recently.items()]
    return {"user_id": user_id, "items": items, "count": len(items)}


@router.post("/replan", response_model=CartResponse)
async def replan_cart(req: ReplanRequest) -> CartResponse:
    """Re-plan a cart based on user feedback."""
    service = get_outcome_service()
    cart = await service.replan_cart(
        text=req.text, feedback=req.feedback, user_id=req.user_id, servings=req.servings
    )
    return CartResponse.from_domain(cart)


@router.post("/counterfactuals")
async def get_counterfactuals(req: CounterfactualRequest):
    """Get 'why not this one?' explanations for rejected alternatives."""
    service = get_counterfactual_service()
    candidates_tuples = [
        (c[0], c[1], c[2], c[3], c[4] if len(c) > 4 else None)
        for c in req.candidates
    ]
    return await service.get_counterfactuals_for_cart_item(
        need_name=req.need_name,
        selected_product_id=req.selected_product_id,
        candidates=candidates_tuples,
        user_id=req.user_id,
    )
