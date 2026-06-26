"""Catalog controller — product search and category endpoints (Requirement 1.2, 8.3).

Routes:
    GET  /api/catalog/search        ?q=&category=&limit=  -> list of Product dicts
    GET  /api/catalog/recommend     ?q=&limit=            -> { best: Product, alternatives: Product[] }
    GET  /api/catalog/product/{id}                        -> single Product dict or 404
"""
from fastapi import APIRouter, HTTPException, Query

from app.repositories import get_repository
from app.services.catalog_service import get_catalog_service

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/search")
async def search_products(
    q: str | None = Query(default=None, description="Text search query"),
    category: str | None = Query(default=None, description="Category filter"),
    limit: int = Query(default=20, ge=1, le=100, description="Max results"),
):
    """Search the product catalog by text and/or category.

    Returns a list of matching products.
    """
    service = get_catalog_service()
    products = await service.search_products(query=q, category=category, limit=limit)
    return [p.model_dump() for p in products]


@router.get("/recommend")
async def recommend_products(
    q: str = Query(description="Search query for product recommendation"),
    limit: int = Query(default=5, ge=1, le=20, description="Max alternatives"),
):
    """Recommend the best-rated product and alternatives for a search query.

    Returns the best-rated matching product and a list of alternatives,
    without adding anything to the cart. The user decides what to add.
    """
    service = get_catalog_service()
    result = await service.recommend_products(query=q, top_k=limit)
    best = result["best"]
    alternatives = result["alternatives"]
    return {
        "best": best.model_dump() if best else None,
        "alternatives": [p.model_dump() for p in alternatives] if alternatives else [],
    }


@router.get("/product/{product_id}")
async def get_product(product_id: str):
    """Fetch a single product by its ID. Returns 404 if not found."""
    repo = get_repository()
    product = await repo.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    return product.model_dump()
