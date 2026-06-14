"""Catalog service — product lookup, fuzzy match, category filter, availability (Requirements 1.2, 1.3, 8.3).

Provides:
- search_products: text search across names/brands/categories with relevance ranking
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
# Product-name disambiguation helpers.
#
# The core problem: searching "tomato" naively returns Tomato Ketchup,
# Tomato Sauce, Tomato Soup, AND actual Tomatoes. We solve this by scoring
# products on how "primary" the query term is in the product name/category.
#
# A product is a PRIMARY match when the query IS the product (e.g. "Tomato"
# the vegetable). It is a DERIVED/COMPOUND match when the query is just an
# ingredient or flavor modifier (e.g. "Tomato Ketchup", "Tomato Soup").
# ---------------------------------------------------------------------------

# Common compound/derived product indicators — if these words follow or
# accompany the query term, the product is likely a derived item, not the
# primary product itself.
_DERIVED_INDICATORS = {
    "sauce", "ketchup", "soup", "paste", "puree", "juice", "jam", "jelly",
    "pickle", "chutney", "powder", "chips", "flavour", "flavor", "flavoured",
    "flavored", "spread", "dip", "mix", "masala", "curry", "based", "infused",
    "extract", "syrup", "squash", "concentrate", "drink", "candy", "toffee",
    "bar", "cake", "cookie", "biscuit", "wafer", "noodles",
    "instant", "ready", "oats", "cereal", "muesli", "rings", "nuggets",
    "fries", "burger", "pizza", "wrap", "roll", "samosa", "pakora",
    "bhujia", "papad", "poppadom", "chaat", "nachos", "crackers",
    "chocolate", "ice", "cream", "milkshake", "smoothie", "shake",
}


def _compute_relevance_score(query: str, product: Product) -> float:
    """Compute a relevance score (0-100) for how well a product matches the query.

    E-commerce search ranking priority (inspired by Amazon/BigBasket/Flipkart):
      1. Product name IS the query (exact or near-exact) → highest score
      2. Product name STARTS WITH the query → very high
      3. Query is a primary word in the product name → high
      4. Query matches the sub_category/type → medium-high
      5. Query appears in name but product is derived/compound → medium-low
      6. Query only matches brand name → very low (brand is NOT the product)

    Key principle: When a user searches "milk", they want MILK products,
    not "Curd by MilkLane". The product NAME is king.
    """
    query_lower = query.lower().strip()
    query_words = query_lower.split()
    name_lower = product.name.lower()
    name_words = set(name_lower.replace("-", " ").replace("/", " ").replace("(", " ").replace(")", " ").split())
    sub_cat_lower = product.sub_category.lower()
    category_lower = product.category.lower()
    brand_lower = product.brand.lower()

    score = 0.0

    # ===== CRITICAL CHECK: Is the query ONLY in the brand name? =====
    # If the query appears in the brand but NOT in the product name or category,
    # this is almost certainly irrelevant (e.g., "milk" → "Curd" by "MilkLane")
    query_in_name = query_lower in name_lower
    query_in_sub_cat = query_lower in sub_cat_lower
    query_in_category = query_lower in category_lower
    query_in_brand = query_lower in brand_lower

    # Word-level check for the name (handles "Toned Milk" matching "milk")
    query_word_in_name = any(
        any(nw.startswith(qw) or qw.startswith(nw) for nw in name_words if len(nw) > 2)
        for qw in query_words
    )

    if not query_in_name and not query_word_in_name and not query_in_sub_cat and not query_in_category:
        # Query only matches brand or some other weak signal — heavily penalize
        if query_in_brand:
            return 5.0 + min((product.rating or 0) / 10.0, 0.5)
        return 2.0

    # ===== From here, query is confirmed to be in name/category =====

    # Remove size/unit info from name for core comparison
    name_core = re.sub(r'\d+\s*(kg|g|gm|ml|l|ltr|litre|pack|pcs|unit)\b', '', name_lower, flags=re.IGNORECASE).strip()
    name_core = re.sub(r'[-/,()]', ' ', name_core).strip()
    name_core_words = [w for w in name_core.split() if w]

    # Remove brand from name_core for comparison
    brand_words = set(brand_lower.split())
    name_significant_words = [w for w in name_core_words if w not in brand_words and len(w) > 1]

    # Stem sets for comparison
    query_stem_set = {w.rstrip("s").rstrip("es") for w in query_words}
    name_stem_set = {w.rstrip("s").rstrip("es") for w in name_significant_words}

    # Qualifier words that don't affect "primary" status
    qualifiers = {"fresh", "organic", "natural", "pure", "premium", "best", "local",
                  "farm", "desi", "indian", "green", "red", "yellow", "big", "small",
                  "baby", "mini", "large", "jumbo", "ripe", "raw", "whole", "sliced",
                  "chopped", "cut", "seedless", "hybrid", "toned", "double", "full",
                  "skimmed", "taaza", "gold", "classic", "regular", "special", "lite",
                  "low", "fat", "sugar", "free", "extra", "super", "new", "original",
                  "homogenised", "pasteurised", "standardised"}

    # Non-query significant words (excluding qualifiers)
    non_query_words = name_stem_set - query_stem_set - qualifiers - brand_words

    # Check for derived indicators in the product name
    name_significant_words_set = set(name_significant_words)
    has_derived_indicator = bool(name_significant_words_set & _DERIVED_INDICATORS)

    # --- Scoring tiers ---

    if not has_derived_indicator and len(non_query_words) <= 1:
        # TIER 1: PRIMARY match — product IS the query
        # e.g., "Milk" → "Toned Milk 1L", "Full Cream Milk"
        if any(qs in sub_cat_lower for qs in query_stem_set):
            score = 98.0
        elif query_in_name:
            score = 95.0
        else:
            score = 92.0
    elif not has_derived_indicator and query_in_sub_cat:
        # TIER 2: Sub-category confirms product type
        score = 85.0
    elif not has_derived_indicator and query_in_name:
        # TIER 3: Query in name, no derived indicators, but extra meaningful words
        # e.g., "Chocolate Milk" when searching "milk" — still relevant
        # Check how prominent the query is in the name
        query_word_count = sum(1 for qs in query_stem_set if any(nw.startswith(qs) for nw in name_stem_set))
        name_word_count = len(name_significant_words)
        if name_word_count > 0 and query_word_count / name_word_count >= 0.5:
            score = 80.0
        else:
            score = 72.0
    elif has_derived_indicator and query_in_name:
        # TIER 4: DERIVED product — query is an ingredient/flavor
        # e.g., "Tomato Ketchup" when searching "tomato"
        score = 35.0
    elif query_in_sub_cat or query_in_category:
        # TIER 5: Only category/sub_category match
        score = 30.0
    else:
        score = 15.0

    # Small tie-breaking boost from rating (max 0.5 points — never enough to jump tiers)
    if product.rating:
        score += min(product.rating / 10.0, 0.5)

    return min(score, 100.0)


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
        1. Find products where the query appears in name/brand/sub_category.
        2. Score all candidates using category-aware relevance ranking.
        3. Primary products (where query IS the product) rank above derived
           products (where query is just an ingredient/flavor).
        4. Within the same relevance tier, sort by rating.
        5. Return best as "best", rest as "alternatives".

        Example: query="tomato" → best = "Fresh Tomato 500g" (vegetable),
                 alternatives include other tomato varieties, with Tomato Ketchup
                 ranked much lower (or excluded).
        """
        all_products = await self._get_all_products()
        if not all_products:
            return {"best": None, "alternatives": []}

        query_lower = query.lower().strip()

        # Strategy 1: Find products where query appears in the product NAME or sub_category
        # (NOT just brand — brand-only matches are irrelevant)
        primary_candidates = [
            p for p in all_products
            if query_lower in p.name.lower()
            or query_lower in p.sub_category.lower()
        ]

        # Strategy 2: Word-level name matching (handles multi-word queries)
        if len(primary_candidates) < top_k + 1:
            query_words = query_lower.split()
            word_matches = [
                p for p in all_products
                if p not in primary_candidates and any(
                    word in p.name.lower() or word in p.sub_category.lower()
                    for word in query_words
                )
            ]
            primary_candidates.extend(word_matches)

        # Strategy 3: Brand matches as low-priority fallback (only if we have
        # very few primary candidates)
        brand_matches = []
        if len(primary_candidates) < 2:
            brand_matches = [
                p for p in all_products
                if p not in primary_candidates
                and query_lower in p.brand.lower()
            ]

        # Strategy 4: Fuzzy matching as last resort
        if len(primary_candidates) + len(brand_matches) < 2:
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
                    if p.name in matched_names
                    and p not in primary_candidates
                    and p not in brand_matches
                ]
                brand_matches.extend(fuzzy_candidates)

        # Combine: primary candidates first, brand/fuzzy as fallback
        candidates = primary_candidates + brand_matches

        if not candidates:
            return {"best": None, "alternatives": []}

        # Filter to only in-stock products (prefer showing available items)
        in_stock = [p for p in candidates if p.in_stock]
        if in_stock:
            candidates = in_stock

        # Score each candidate with relevance-aware ranking
        scored_candidates = [
            (p, _compute_relevance_score(query, p)) for p in candidates
        ]

        # Sort by: relevance score (primary), then rating (secondary tie-break)
        scored_candidates.sort(
            key=lambda x: (x[1], x[0].rating if x[0].rating is not None else 0.0),
            reverse=True,
        )

        # Best = highest relevance product, alternatives = next best
        best = scored_candidates[0][0]
        alternatives = [p for p, _s in scored_candidates[1:top_k]]

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
        """Search products by text query and/or category with relevance ranking.

        Uses category-aware scoring to rank results: primary products
        (where the query IS the product) rank above derived/compound products
        (where the query is just an ingredient or flavor).

        Example: searching "tomato" returns actual Tomatoes first, then
        Tomato Ketchup, Tomato Sauce, etc. lower in the list.
        """
        results = await self.repo.list_products(category=category, search=query)

        # If no text query, no relevance ranking needed (pure category browse)
        if not query or not results:
            return results[:limit]

        # Score and rank by relevance
        scored = [(p, _compute_relevance_score(query, p)) for p in results]
        scored.sort(key=lambda x: x[1], reverse=True)

        return [p for p, _score in scored[:limit]]

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
        """Match a need name to catalog products using fuzzy string matching
        with category-aware disambiguation.

        Uses a combination of:
        - rapidfuzz scorers (WRatio for overall quality)
        - word-presence scoring for substring matching
        - category-aware relevance scoring to prefer primary products over
          derived/compound products (e.g. "tomato" → actual Tomato vegetable
          ranks above "Tomato Ketchup")

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

        # Re-rank using word-presence scoring + category-aware relevance.
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

            # --- Category-aware relevance adjustment ---
            # If category_hint is provided, boost products that are PRIMARY
            # matches for the need (the product IS the need) and penalize
            # derived/compound products (need is just an ingredient/flavor).
            relevance_adjustment = 0.0
            if category_hint:
                relevance_score = _compute_relevance_score(need_name, product)
                # Strong bonus for primary products (relevance >= 75)
                if relevance_score >= 75:
                    relevance_adjustment = 15.0
                # Mild bonus for category-confirmed products
                elif relevance_score >= 60:
                    relevance_adjustment = 8.0
                # Penalty for clearly derived products when we have a category hint
                elif relevance_score <= 35:
                    relevance_adjustment = -10.0

            final_score = min(max(score + bonus - penalty + relevance_adjustment, 0), 100.0)
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
