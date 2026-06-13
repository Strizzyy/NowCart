"""Catalog service — product lookup, fuzzy match, category filter, availability (Requirements 1.2, 1.3, 8.3).

Provides:
- search_products: text search across names/brands/categories
- get_by_category: filter products by category
- check_availability: stock lookup with override support (demo control)
- fuzzy_match_need: rapidfuzz matching of a need name to catalog products
"""
from __future__ import annotations

from rapidfuzz import fuzz, process

from app.models.domain import Product
from app.repositories import get_repository, get_cache
from app.repositories.base import Repository
from app.repositories.cache import CacheLayer


class CatalogService:
    """Handles product search, filtering, availability, and fuzzy matching."""

    def __init__(
        self,
        repo: Repository | None = None,
        cache: CacheLayer | None = None,
    ) -> None:
        self._repo = repo
        self._cache = cache
        # In-memory product cache to avoid repeated DynamoDB scans
        self._products_cache: list[Product] | None = None

    @property
    def repo(self) -> Repository:
        if self._repo is None:
            self._repo = get_repository()
        return self._repo

    @property
    def cache(self) -> CacheLayer:
        if self._cache is None:
            self._cache = get_cache()
        return self._cache

    async def _get_all_products(self) -> list[Product]:
        """Return all products, using an in-memory cache to avoid repeated DynamoDB scans."""
        if self._products_cache is None:
            self._products_cache = await self.repo.list_products()
        return self._products_cache

    # ------------------------------------------------------------------
    # Search & filter
    # ------------------------------------------------------------------

    async def search_products(
        self,
        query: str | None = None,
        category: str | None = None,
        limit: int = 20,
    ) -> list[Product]:
        """Search products by text query and/or category.

        Uses the repository's list_products which does case-insensitive
        substring matching on name, brand, category, and sub_category.
        """
        results = await self.repo.list_products(category=category, search=query)
        return results[:limit]

    async def get_by_category(self, category: str) -> list[Product]:
        """Return all products in a given category."""
        return await self.repo.list_products(category=category)

    # ------------------------------------------------------------------
    # Availability (Requirement 8.3)
    # ------------------------------------------------------------------

    async def check_availability(self, product_id: str) -> bool:
        """Check if a product is in stock, respecting stock overrides.

        Priority:
        1. Cache override (stock:{product_id}) — demo control
        2. Product.in_stock field from the repository
        """
        # Check override first
        override = await self.cache.get_stock_override(product_id)
        if override is not None:
            return override

        # Fall back to product record
        product = await self.repo.get_product(product_id)
        if product is None:
            return False
        return product.in_stock

    # ------------------------------------------------------------------
    # Fuzzy matching (Requirement 1.2)
    # ------------------------------------------------------------------

    async def fuzzy_match_need(
        self,
        need_name: str,
        category_hint: str | None = None,
        top_k: int = 5,
    ) -> list[tuple[Product, float]]:
        """Match a need name to catalog products using fuzzy string matching.

        Uses rapidfuzz token_sort_ratio for flexible matching. If a
        category_hint is provided, candidates are first filtered by category
        (case-insensitive) before scoring.

        Returns:
            List of (Product, score) tuples sorted by score descending.
            Score is 0-100 (rapidfuzz scale).
        """
        # Get candidate pool from in-memory cache (avoid DynamoDB scan per need)
        all_products = await self._get_all_products()

        if category_hint:
            cat_lower = category_hint.lower()
            candidates = [p for p in all_products if cat_lower in p.category.lower() or cat_lower in p.sub_category.lower()]
            # If category filter returns nothing, fall back to full catalog
            if not candidates:
                candidates = all_products
        else:
            candidates = all_products

        if not candidates:
            return []

        # Build choices: use product name for matching
        choices = [p.name for p in candidates]

        # Use rapidfuzz process.extract for efficient batch scoring
        matches = process.extract(
            need_name,
            choices,
            scorer=fuzz.token_sort_ratio,
            limit=top_k,
        )

        # matches is a list of (match_string, score, index)
        results: list[tuple[Product, float]] = []
        for _match_str, score, idx in matches:
            results.append((candidates[idx], score))

        return results


# Module-level singleton for convenience
_catalog_service: CatalogService | None = None


def get_catalog_service() -> CatalogService:
    """Return the singleton CatalogService instance."""
    global _catalog_service
    if _catalog_service is None:
        _catalog_service = CatalogService()
    return _catalog_service
