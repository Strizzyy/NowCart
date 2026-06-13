"""Catalog controller — product search and category endpoints (Requirement 1.2, 8.3).

Routes:
    GET /api/catalog/search  ?q=&category=&limit=  -> list of Product dicts
"""
from fastapi import APIRouter, Query

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
