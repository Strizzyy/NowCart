"""Catalog service — product lookup, fuzzy match, category filter, availability (Requirements 1.2, 1.3, 8.3).

Provides:
- search_products: text search across names/brands/categories
- get_by_category: filter products by category
- check_availability: stock lookup with override support (demo control)
- fuzzy_match_need: rapidfuzz matching of a need name to catalog products
"""
from __future__ import annotations

import re

from rapidfuzz import fuzz, process

from app.models.domain import Product
from app.repositories import get_repository, get_cache
from app.repositories.base import Repository
from app.repositories.cache import CacheLayer


# ---------------------------------------------------------------------------
# Category hint → actual catalog category/sub_category mapping.
# The LLM returns short hints like "grains", "meat", "spices" but the catalog
# uses BigBasket-style names like "foodgrains oil masala", "eggs meat fish".
# This map bridges the gap for reliable category filtering.
# ---------------------------------------------------------------------------
_CATEGORY_ALIASES: dict[str, list[str]] = {
    # Grains & staples
    "grains": ["foodgrains oil masala", "rice", "dals pulses", "flours sooji"],
    "rice": ["foodgrains oil masala", "rice"],
    "atta": ["foodgrains oil masala", "flours sooji"],
    "flour": ["foodgrains oil masala", "flours sooji"],
    "pulses": ["foodgrains oil masala", "dals pulses"],
    "lentils": ["foodgrains oil masala", "dals pulses"],
    "dals": ["foodgrains oil masala", "dals pulses"],
    # Oils & ghee
    "oils": ["foodgrains oil masala", "edible oils ghee"],
    "oil": ["foodgrains oil masala", "edible oils ghee"],
    "ghee": ["foodgrains oil masala", "edible oils ghee"],
    "edible oil": ["foodgrains oil masala", "edible oils ghee"],
    # Spices & masala
    "spices": ["foodgrains oil masala", "masala", "gourmet world food"],
    "masala": ["foodgrains oil masala", "gourmet world food"],
    "herbs": ["foodgrains oil masala", "gourmet world food", "fruits vegetables"],
    "condiments": ["foodgrains oil masala", "gourmet world food"],
    # Vegetables & fruits
    "vegetables": ["fruits vegetables", "fresh vegetables", "organic fruits vegetables"],
    "fruits": ["fruits vegetables", "fresh fruits", "organic fruits vegetables"],
    "fresh produce": ["fruits vegetables"],
    # Meat, eggs, fish
    "meat": ["eggs meat fish", "mutton lamb"],
    "chicken": ["eggs meat fish"],
    "fish": ["eggs meat fish", "fish seafood"],
    "seafood": ["eggs meat fish", "fish seafood"],
    "eggs": ["eggs meat fish", "eggs"],
    # Dairy
    "dairy": ["bakery cakes dairy", "dairy cheese"],
    "milk": ["bakery cakes dairy", "dairy cheese"],
    "cheese": ["bakery cakes dairy", "dairy cheese"],
    "paneer": ["bakery cakes dairy", "dairy cheese"],
    "yogurt": ["bakery cakes dairy", "dairy cheese"],
    "curd": ["bakery cakes dairy", "dairy cheese"],
    # Bakery
    "bakery": ["bakery cakes dairy", "gourmet breads", "cakes pastries"],
    "bread": ["bakery cakes dairy", "gourmet breads"],
    # Beverages
    "beverages": ["beverages", "coffee", "tea"],
    "tea": ["beverages"],
    "coffee": ["beverages"],
    "juice": ["beverages"],
    # Snacks
    "snacks": ["snacks branded foods", "biscuits cookies", "chocolates candies"],
    "chocolates": ["snacks branded foods", "chocolates candies"],
    "biscuits": ["snacks branded foods", "biscuits cookies"],
    # Health & breakfast
    "breakfast cereals": ["snacks branded foods", "breakfast cereals"],
    "health foods": ["snacks branded foods", "health drink supplement"],
    "dry fruits": ["snacks branded foods", "gourmet world food"],
    "nuts": ["snacks branded foods", "gourmet world food"],
    # Cooking & baking
    "cooking": ["gourmet world food", "cooking baking needs"],
    "baking": ["gourmet world food", "cooking baking needs"],
    "spreads": ["gourmet world food", "snacks branded foods"],
    # Ready to cook
    "ready to cook": ["snacks branded foods", "frozen veggies snacks"],
    "frozen": ["snacks branded foods", "frozen veggies snacks"],
}


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

    # ------------------------------------------------------------------
    # Recommendation: best-rated + alternatives (search without adding to cart)
    # ------------------------------------------------------------------

    async def recommend_products(
        self,
        query: str,
        top_k: int = 5,
    ) -> dict[str, list[Product] | Product | None]:
        """Search for a product by name/query and return the best-rated match
        plus alternatives, without adding anything to the cart.

        Strategy:
        1. First, find products where the query appears as a substring in
           the name, brand, category, or sub_category (most relevant).
        2. If not enough results, fall back to fuzzy matching.
        3. Sort results by rating descending.
        4. Return best-rated as "best", rest as "alternatives".

        Returns a dict with:
          - best: the highest-rated matching product (or None)
          - alternatives: other matching products sorted by rating descending
        """
        all_products = await self._get_all_products()
        if not all_products:
            return {"best": None, "alternatives": []}

        query_lower = query.lower().strip()

        # Strategy 1: Exact substring matches (highest relevance)
        candidates = [
            p for p in all_products
            if query_lower in p.name.lower()
            or query_lower in p.brand.lower()
            or query_lower in p.sub_category.lower()
        ]

        # Strategy 2: If not enough substring matches, try word-level matching
        if len(candidates) < top_k + 1:
            query_words = query_lower.split()
            word_matches = [
                p for p in all_products
                if p not in candidates and any(
                    word in p.name.lower() or word in p.sub_category.lower()
                    for word in query_words
                )
            ]
            candidates.extend(word_matches)

        # Strategy 3: If still not enough, use fuzzy matching as fallback
        if len(candidates) < 2:
            product_names = [p.name for p in all_products]
            fuzzy_matches = process.extract(
                query,
                product_names,
                scorer=fuzz.WRatio,
                limit=top_k * 3,
                score_cutoff=50.0,
            )
            if fuzzy_matches:
                matched_names = {m[0] for m in fuzzy_matches}
                fuzzy_candidates = [
                    p for p in all_products
                    if p.name in matched_names and p not in candidates
                ]
                candidates.extend(fuzzy_candidates)

        if not candidates:
            return {"best": None, "alternatives": []}

        # Filter to only in-stock products (prefer showing available items)
        in_stock = [p for p in candidates if p.in_stock]
        if in_stock:
            candidates = in_stock

        # Sort by rating descending (None ratings go to the end)
        candidates_sorted = sorted(
            candidates,
            key=lambda p: (p.rating if p.rating is not None else 0.0),
            reverse=True,
        )

        # Best rated = first, alternatives = rest
        best = candidates_sorted[0]
        alternatives = candidates_sorted[1:top_k]

        return {"best": best, "alternatives": alternatives}

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
    # Category filtering helpers
    # ------------------------------------------------------------------

    def _filter_by_category_hint(
        self, all_products: list[Product], category_hint: str
    ) -> list[Product]:
        """Filter products by category hint using alias mapping + substring fallback.

        Strategy:
        1. Look up the hint in _CATEGORY_ALIASES for known mappings.
        2. If no alias, do bidirectional substring matching (hint in category OR
           category words in hint).
        3. If nothing matches, return the full catalog (let fuzzy scoring decide).
        """
        hint_lower = category_hint.lower().strip()

        # Strategy 1: Use known alias mapping
        alias_targets = _CATEGORY_ALIASES.get(hint_lower, [])
        if alias_targets:
            candidates = [
                p for p in all_products
                if any(
                    target in p.category.lower() or target in p.sub_category.lower()
                    for target in alias_targets
                )
            ]
            if candidates:
                return candidates

        # Strategy 2: Bidirectional substring matching
        candidates = [
            p for p in all_products
            if (hint_lower in p.category.lower()
                or hint_lower in p.sub_category.lower()
                or p.category.lower() in hint_lower
                or any(word in hint_lower for word in p.sub_category.lower().split()))
        ]
        if candidates:
            return candidates

        # Strategy 3: Fall back to full catalog
        return all_products

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

        Uses a combination of rapidfuzz scorers (WRatio for overall quality,
        partial_ratio for substring presence) to handle the mismatch between
        short ingredient names ("basmati rice") and long product names
        ("Organic Basmati Rice - Premium Quality 1kg").

        Category filtering uses an alias map to bridge LLM hints to BigBasket
        category names.

        Returns:
            List of (Product, score) tuples sorted by score descending.
            Score is 0-100 (rapidfuzz scale).
        """
        all_products = await self._get_all_products()

        # Filter candidates by category
        if category_hint:
            candidates = self._filter_by_category_hint(all_products, category_hint)
        else:
            candidates = all_products

        if not candidates:
            return []

        # Build choices for matching
        choices = [p.name for p in candidates]

        # Use WRatio which intelligently picks the best scorer per pair.
        # Get extra candidates for re-ranking.
        matches = process.extract(
            need_name,
            choices,
            scorer=fuzz.WRatio,
            limit=min(top_k * 4, len(choices)),
        )

        # Re-rank using word-presence scoring.
        # The key insight: if the user needs "onions", a product with "onion"
        # in the name is almost certainly correct even if WRatio gives it a
        # mediocre score due to extra words in the product name.
        need_words = [w.rstrip("s") for w in need_name.lower().split() if len(w) > 2]
        results: list[tuple[Product, float]] = []

        for _match_str, score, idx in matches:
            product = candidates[idx]
            name_lower = product.name.lower()
            # Split product name into words for boundary-aware matching
            name_words = set(name_lower.replace("-", " ").replace("/", " ").split())

            # Count how many need words (or their stems) appear as whole words
            # or as substrings in the product name
            word_hits = 0
            for w in need_words:
                # Check if stem appears as a standalone word or prefix of a word
                if any(nw.startswith(w) or w.startswith(nw) for nw in name_words if len(nw) > 2):
                    word_hits += 1
                elif w in name_lower:
                    # Substring match but check it's not embedded in an unrelated word
                    # e.g. "salt" in "unsalted" should not count
                    if re.search(r'\b' + re.escape(w), name_lower):
                        word_hits += 1

            # Bonus: significant boost for word presence
            if word_hits >= 2:
                bonus = 35
            elif word_hits == 1:
                bonus = 20
            else:
                bonus = 0

            # Penalty: if NO need words appear in product name and the base
            # score is below 70, it's likely a false positive from WRatio
            if word_hits == 0 and score < 70:
                penalty = 15
            else:
                penalty = 0

            final_score = min(max(score + bonus - penalty, 0), 100.0)
            results.append((product, final_score))

        # Sort by final score and return top_k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


# Module-level singleton for convenience
_catalog_service: CatalogService | None = None


def get_catalog_service() -> CatalogService:
    """Return the singleton CatalogService instance."""
    global _catalog_service
    if _catalog_service is None:
        _catalog_service = CatalogService()
    return _catalog_service
