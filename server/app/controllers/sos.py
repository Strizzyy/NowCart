"""SOS controller — D4 emergency mode.

Routes:
    POST /api/sos  -> CartResponse
"""
from fastapi import APIRouter

from app.models.dto.requests import SosRequest
from app.models.dto.responses import CartResponse
from app.services.sos_service import get_sos_service

router = APIRouter(prefix="/api", tags=["sos"])


@router.post("/sos", response_model=CartResponse)
async def sos_cart(req: SosRequest) -> CartResponse:
    """Build an emergency kit cart from a situation description."""
    service = get_sos_service()
    cart = await service.build_sos_cart(situation=req.situation)
    return CartResponse.from_domain(cart)
