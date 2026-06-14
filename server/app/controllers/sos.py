"""SOS controller — D4 emergency mode.

Routes:
    POST /api/sos           -> CartResponse (legacy: builds full cart)
    POST /api/sos/recommend -> list of recommended products with reasons
"""
from fastapi import APIRouter

from app.models.dto.requests import SosRequest
from app.models.dto.responses import CartResponse, ProductResponse
from app.services.sos_service import get_sos_service

router = APIRouter(prefix="/api", tags=["sos"])


@router.post("/sos", response_model=CartResponse)
async def sos_cart(req: SosRequest) -> CartResponse:
    """Build an emergency kit cart from a situation description."""
    service = get_sos_service()
    cart = await service.build_sos_cart(situation=req.situation)
    return CartResponse.from_domain(cart)


@router.post("/sos/recommend")
async def sos_recommend(req: SosRequest):
    """Analyze an emergency situation and recommend products without adding to cart.

    Returns a list of recommended products with full details (images, rating,
    price, description) and a reason for each recommendation. The user decides
    which ones to add to their cart.
    """
    service = get_sos_service()
    recommendations = await service.recommend_sos_products(situation=req.situation)
    return recommendations
