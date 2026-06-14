"""Predictive controller — Zero Door, preferences, pantry, re-planning, counterfactuals.

Routes:
    GET  /api/predict/{user_id}        → predicted restock cart (Zero Door)
    GET  /api/predict/{user_id}/insights → raw prediction insights
    GET  /api/preferences/{user_id}    → user preference profile
    GET  /api/pantry/{user_id}         → inferred pantry contents
    POST /api/replan                   → re-plan cart with feedback
    POST /api/counterfactuals          → get "why not" for a cart item
"""
from fastapi import APIRouter

from pydantic import BaseModel, Field

from app.models.dto.responses import CartResponse
from app.services.predictive_service import get_predictive_service
from app.services.preference_service import get_preference_service
from app.services.pantry_service import get_pantry_service
from app.services.outcome_service import get_outcome_service
from app.services.counterfactual_service import get_counterfactual_service

router = APIRouter(prefix="/api", tags=["predictive"])


# --- Request DTOs ---

class ReplanRequest(BaseModel):
    """Re-plan an existing cart with user feedback."""
    text: str = Field(..., min_length=1, description="Original input text")
    feedback: str = Field(..., min_length=1, description="User feedback, e.g. 'make it cheaper'")
    user_id: str | None = None
    servings: int | None = None


class CounterfactualRequest(BaseModel):
    """Get counterfactual explanations for a cart item."""
    need_name: str = Field(..., description="The need/ingredient name")
    selected_product_id: str = Field(..., description="The product that was selected")
    candidates: list[list] = Field(..., description="Candidates list from the pipeline")
    user_id: str | None = None


# --- Endpoints ---

@router.get("/predict/{user_id}")
async def get_predicted_cart(user_id: str):
    """Zero Door — get a pre-staged restock cart based on purchase patterns.

    Analyzes order history to predict what the user needs before they ask.
    Returns a full CartResponse if predictions exist, or a message if not.
    """
    service = get_predictive_service()
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


@router.get("/predict/{user_id}/insights")
async def get_prediction_insights(user_id: str):
    """Get raw prediction insights without building a cart.

    Returns per-product depletion predictions with confidence scores.
    Useful for "you might need soon" suggestion chips.
    """
    service = get_predictive_service()
    insights = await service.get_prediction_insights(user_id)

    return {
        "user_id": user_id,
        "predictions": insights,
        "count": len(insights),
    }


@router.get("/preferences/{user_id}")
async def get_user_preferences(user_id: str):
    """Get the computed preference profile for a user.

    Returns brand affinity, price tier, dietary signals, top products, etc.
    This is the "taste graph" that powers personalized matching.
    """
    service = get_preference_service()
    preference = await service.get_user_preference(user_id)

    if preference is None:
        return {
            "message": "No order history found — preferences not yet available.",
            "preference": None,
        }

    return {
        "message": f"Preference profile computed from {preference.total_orders} orders",
        "preference": preference.model_dump(),
    }


@router.get("/pantry/{user_id}")
async def get_user_pantry(user_id: str):
    """Get the inferred pantry for a user.

    Returns items the user likely still has at home (based on recent
    purchases and estimated consumption rates).
    """
    service = get_pantry_service()
    pantry = await service.get_pantry(user_id)

    return {
        "user_id": user_id,
        "items": [item.model_dump() for item in pantry],
        "count": len(pantry),
    }


@router.post("/replan", response_model=CartResponse)
async def replan_cart(req: ReplanRequest) -> CartResponse:
    """Re-plan a cart based on user feedback.

    Triggers the conversational re-planning loop in the LangGraph pipeline.
    Handles feedback like:
    - "make it cheaper" → budget optimization
    - "I'm vegan" → dietary filtering
    - "swap paneer for tofu" → specific substitution
    - "remove the oil" → item removal
    """
    service = get_outcome_service()
    cart = await service.replan_cart(
        text=req.text,
        feedback=req.feedback,
        user_id=req.user_id,
        servings=req.servings,
    )
    return CartResponse.from_domain(cart)


@router.post("/counterfactuals")
async def get_counterfactuals(req: CounterfactualRequest):
    """Get 'why not this one?' explanations for rejected alternatives.

    For a selected product, explains why each competing candidate was
    not chosen — with personalized reasons if user_id is provided.
    """
    service = get_counterfactual_service()

    # Convert candidates from list format to tuple format
    candidates_tuples = [
        (c[0], c[1], c[2], c[3], c[4] if len(c) > 4 else None)
        for c in req.candidates
    ]

    result = await service.get_counterfactuals_for_cart_item(
        need_name=req.need_name,
        selected_product_id=req.selected_product_id,
        candidates=candidates_tuples,
        user_id=req.user_id,
    )

    return result
