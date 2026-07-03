"""Admin controller — demo/stock override controls + badge recompute.

Routes:
    POST /api/admin/stock               -> OkResponse
    POST /api/admin/badges/recompute    -> badge recompute summary
"""
from fastapi import APIRouter

from app.models.dto.requests import StockOverrideRequest
from app.models.dto.responses import OkResponse
from app.repositories import get_cache, get_repository

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/stock", response_model=OkResponse)
async def stock_override(req: StockOverrideRequest) -> OkResponse:
    """Override the stock status of a product (demo control).

    Sets a cache override that takes priority over the product record.
    Also updates the product record in the repository for consistency.
    """
    cache = get_cache()
    repo = get_repository()

    await cache.set_stock_override(req.product_id, req.in_stock)

    # Also update the product record directly
    product = await repo.get_product(req.product_id)
    if product:
        product.in_stock = req.in_stock
        await repo.upsert_product(product)

    status = "in_stock" if req.in_stock else "out_of_stock"
    return OkResponse(message=f"Product {req.product_id} marked {status}")


@router.post("/badges/recompute")
async def recompute_badges():
    """Recompute NowCart Verified badges for all products.

    Scans order history from the last 30 days, computes per-category order counts,
    blends with product ratings, and marks products as verified if score >= 0.6.
    """
    from app.services.badge_service import get_badge_service
    badge_service = get_badge_service()
    result = await badge_service.recompute_badges()
    return {
        "message": "Badge recompute complete",
        **result,
    }
