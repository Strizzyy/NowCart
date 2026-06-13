"""Constraint controller — A3 budget-first ordering.

Routes:
    POST /api/constraint  -> CartResponse
"""
from fastapi import APIRouter

from app.models.dto.requests import ConstraintRequest
from app.models.dto.responses import CartResponse
from app.services.budget_service import get_budget_service

router = APIRouter(prefix="/api", tags=["constraint"])


@router.post("/constraint", response_model=CartResponse)
async def constraint_cart(req: ConstraintRequest) -> CartResponse:
    """Build a cart constrained to the given budget."""
    service = get_budget_service()
    cart = await service.build_constrained_cart(
        text=req.text or "groceries",
        budget=req.budget,
        servings=req.servings,
    )
    return CartResponse.from_domain(cart)
