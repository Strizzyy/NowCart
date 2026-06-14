"""Cart controller — cart operations (add/remove/update/get).

Routes:
    POST /api/cart/op          -> CartResponse
    GET  /api/cart/{session_id} -> CartResponse
"""
from fastapi import APIRouter, HTTPException

from app.models.dto.requests import CartOpRequest
from app.models.dto.responses import CartResponse
from app.services.cart_ops_service import get_cart_ops_service

router = APIRouter(prefix="/api/cart", tags=["cart"])


@router.post("/op", response_model=CartResponse)
async def cart_operation(req: CartOpRequest) -> CartResponse:
    """Execute a cart operation (add, remove, update, total)."""
    service = get_cart_ops_service()

    match req.op.lower():
        case "add":
            cart = await service.add_item(
                session_id=req.session_id,
                entity=req.entity or "",
                quantity=req.quantity or 1.0,
            )
        case "remove":
            cart = await service.remove_item(
                session_id=req.session_id,
                entity=req.entity or "",
            )
        case "update":
            cart = await service.update_quantity(
                session_id=req.session_id,
                entity=req.entity or "",
                quantity=req.quantity or 1.0,
            )
        case "clear":
            cart = await service.clear_cart(req.session_id)
        case "total":
            total = await service.get_total(req.session_id)
            if total is None:
                raise HTTPException(status_code=404, detail="Cart not found")
            # Return minimal cart response with just the total
            cart = await service.get_cart(req.session_id)
            if cart is None:
                raise HTTPException(status_code=404, detail="Cart not found")
        case _:
            raise HTTPException(status_code=400, detail=f"Unknown op: {req.op}")

    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")

    return CartResponse.from_domain(cart)


@router.get("/{session_id}", response_model=CartResponse)
async def get_cart(session_id: str) -> CartResponse:
    """Retrieve a cart by session ID."""
    service = get_cart_ops_service()
    cart = await service.get_cart(session_id)
    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    return CartResponse.from_domain(cart)
