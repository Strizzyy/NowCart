"""Hybrid Retrieval Service — Bi-encoder + Cross-encoder + Rapidfuzz.

Three-stage pipeline for robust product retrieval:

1. **Bi-encoder (all-MiniLM-L6-v2, 80MB)**: Semantic embedding for fast similarity
   - Encodes all products at startup into 384-dim vectors
   - Query-time: encode need text, find top-20 by cosine similarity (~15ms)
   - Handles semantic matches: "cottage cheese" → "paneer", "breakfast" → "cereals"

2. **Cross-encoder (ms-marco-MiniLM-L-6-v2, 80MB)**: Pairwise re-ranking
   - Re-ranks the top-20 candidates by direct query-product comparison (~50ms)
   - Improves precision: distinguishes "tomato" from "tomato ketchup"
   - Returns ordered list with relevance scores

3. **Rapidfuzz fallback**: Typo correction
   - Catches spelling errors: "panner" → "paneer", "tomatoe" → "tomato" (~3ms)
   - Runs when cross-encoder confidence is low or for supplementary candidates

**Caching**: Cross-encoder results cached in Redis (SHA-256 hash of query+candidates, 1h TTL)
to cut latency from ~800ms to <5ms for repeat queries.

**Memory footprint**: ~300MB total (2 models + embeddings for 9,534 products)

RAG Integration:
- Serves as the retrieval layer for the LangGraph outcome pipeline
- Replaces TF-IDF with true semantic understanding via sentence-transformers
- Maintains the same search_with_context() interface for backward compatibility
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

from app.core.config import settings

if TYPE_CHECKING:
    from app.models.domain.product import Product

logger = logging.getLogger(__name__)

# ── Startup speed: suppress HuggingFace Hub online checks ──────────────────
# Without this, sentence-transformers makes ~20 HTTP HEAD requests to
# huggingface.co on EVERY startup — even when models are already cached.
# Setting TRANSFORMERS_OFFLINE=1 forces local-cache-only loading.
# On first run (cold start / no cache), we override to "0" so the download
# can proceed. The _load_models_sync() method handles the fallback.
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
# ───────────────────────────────────────────────────────────────────────────

# Reuse a single thread pool for CPU-bound model inference to avoid blocking the event loop
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="hybrid-retrieval")

# Bi-encoder re-ranking shortlist size before cross-encoder
_BI_ENCODER_SHORTLIST = 20

# Cross-encoder low-confidence threshold — below this, also run rapidfuzz
_CROSS_ENCODER_LOW_CONF = 0.3

# Rapidfuzz minimum score to include result
_FUZZY_MIN_SCORE = 40.0

# Cache TTL for cross-encoder results (1 hour)
_CACHE_TTL_SECONDS = 3600

# ── Disk cache for pre-computed product embeddings ─────────────────────────
# Avoids re-encoding 9,534 products on every restart (~30-60s → <2s).
# Cache is invalidated if the product count changes.
_EMBED_CACHE_DIR = Path(__file__).parent.parent.parent / ".cache"
_EMBED_CACHE_FILE = _EMBED_CACHE_DIR / "product_embeddings.npz"
# ───────────────────────────────────────────────────────────────────────────


# ---------------------------------------------------------------------------
# Synonym / alias expansion table — bridges language and spelling gaps
# ---------------------------------------------------------------------------
_SYNONYMS: dict[str, list[str]] = {
    "paneer": ["cottage cheese", "chhena", "fresh cheese"],
    "cottage cheese": ["paneer"],
    "curd": ["yogurt", "dahi", "yoghurt"],
    "yogurt": ["curd", "dahi"],
    "malai": ["cream", "fresh cream"],
    "cream": ["malai", "fresh cream"],
    "atta": ["wheat flour", "whole wheat flour", "chakki atta"],
    "wheat flour": ["atta", "chakki atta"],
    "dal": ["lentil", "pulses", "daal"],
    "lentil": ["dal", "pulses"],
    "ghee": ["clarified butter", "desi ghee"],
    "butter": ["makhan", "white butter"],
    "capsicum": ["bell pepper", "shimla mirch"],
    "bell pepper": ["capsicum", "shimla mirch"],
    "coriander": ["dhania", "cilantro"],
    "cilantro": ["coriander", "dhania"],
    "turmeric": ["haldi"],
    "cumin": ["jeera", "zeera"],
    "mustard": ["sarson", "rai"],
    "fenugreek": ["methi"],
    "ajwain": ["carom seeds"],
    "besan": ["gram flour", "chickpea flour"],
    "gram flour": ["besan", "chickpea flour"],
    "poha": ["flattened rice", "beaten rice", "chiwda"],
    "suji": ["semolina", "rava", "sooji"],
    "semolina": ["suji", "rava", "sooji"],
    "jaggery": ["gur", "gud"],
    "tamarind": ["imli"],
    "asafoetida": ["hing"],
    "bay leaf": ["tej patta"],
    "cardamom": ["elaichi"],
    "cinnamon": ["dalchini"],
    "clove": ["laung"],
    "coconut": ["nariyal"],
    "ginger": ["adrak"],
    "garlic": ["lahsun"],
    "onion": ["pyaaz", "pyaj"],
    "potato": ["aloo"],
    "tomato": ["tamatar"],
    "okra": ["bhindi", "lady finger"],
    "lady finger": ["bhindi", "okra"],
    "brinjal": ["eggplant", "baingan", "aubergine"],
    "eggplant": ["brinjal", "baingan"],
    "spinach": ["palak"],
    "bottle gourd": ["lauki", "dudhi"],
    "bitter gourd": ["karela"],
    "ridge gourd": ["turai", "tori"],
}


def _expand_with_synonyms(text: str) -> str:
    """Expand text with known synonyms for better cross-language matching."""
    text_lower = text.lower()
    expanded_parts = [text]
    for term, synonyms in _SYNONYMS.items():
        if term in text_lower:
            expanded_parts.extend(synonyms[:2])
    return " ".join(expanded_parts)


def _build_product_text(product: "Product") -> str:
    """Build a rich text representation for embedding."""
    parts = [product.name, product.name]  # double-weight the name
    if product.brand:
        parts.append(product.brand)
    if product.sub_category:
        parts.append(product.sub_category)
    if product.category:
        parts.append(product.category)
    if product.tags:
        parts.extend(product.tags[:3])
    text = " ".join(parts)
    return _expand_with_synonyms(text)


def _cache_key(query: str, candidate_ids: list[str]) -> str:
    """SHA-256 hash of query + sorted candidate IDs."""
    payload = query + "|" + ",".join(sorted(candidate_ids))
    return "hybrid_rerank:" + hashlib.sha256(payload.encode()).hexdigest()


class HybridRetrievalService:
    """Three-stage product retrieval: Bi-encoder → Cross-encoder → Rapidfuzz.

    Usage:
        service = HybridRetrievalService()
        await service.build_index(products)          # once at startup
        results = await service.search_with_context(query, context, top_k=5)
    """

    def __init__(self) -> None:
        self._bi_encoder = None          # sentence_transformers.SentenceTransformer
        self._cross_encoder = None       # sentence_transformers.CrossEncoder
        self._product_embeddings: np.ndarray | None = None  # (N, 384) float32
        self._product_ids: list[str] = []
        self._product_texts: list[str] = []  # for cross-encoder and fuzzy
        self._product_names: list[str] = []  # raw names for rapidfuzz
        self._indexed = False
        self._models_loaded = False

    # ------------------------------------------------------------------
    # Model loading (lazy, in thread pool to avoid blocking startup)
    # ------------------------------------------------------------------

    def _load_models_sync(self) -> bool:
        """Load bi-encoder and cross-encoder models synchronously.

        Tries local cache first (fast, no HF Hub network requests).
        Falls back to online download on cache miss (first run only).

        Returns True if both models loaded, False if sentence-transformers
        is not installed (graceful degradation to rapidfuzz-only mode).
        """
        try:
            from sentence_transformers import SentenceTransformer, CrossEncoder  # type: ignore[import]

            t0 = time.perf_counter()

            # Try local-only first — no HF Hub HTTP round-trips on warm starts
            try:
                self._bi_encoder = SentenceTransformer(
                    settings.embedding_model, device="cpu", local_files_only=True
                )
            except Exception:
                # Not in local cache — download once, then future restarts are instant
                logger.info("Bi-encoder not cached — downloading from HuggingFace (first run only)...")
                os.environ["TRANSFORMERS_OFFLINE"] = "0"
                self._bi_encoder = SentenceTransformer(
                    settings.embedding_model, device="cpu", local_files_only=False
                )
                os.environ["TRANSFORMERS_OFFLINE"] = "1"

            logger.info("Bi-encoder loaded: %s (%.2fs)", settings.embedding_model, time.perf_counter() - t0)

            t1 = time.perf_counter()
            try:
                self._cross_encoder = CrossEncoder(
                    "cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu",
                    max_length=512, local_files_only=True
                )
            except Exception:
                logger.info("Cross-encoder not cached — downloading from HuggingFace (first run only)...")
                os.environ["TRANSFORMERS_OFFLINE"] = "0"
                self._cross_encoder = CrossEncoder(
                    "cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu",
                    max_length=512, local_files_only=False
                )
                os.environ["TRANSFORMERS_OFFLINE"] = "1"

            logger.info("Cross-encoder loaded: ms-marco-MiniLM-L-6-v2 (%.2fs)", time.perf_counter() - t1)
            return True

        except ImportError:
            logger.warning(
                "sentence-transformers not installed — degraded to rapidfuzz only. "
                "Install with: uv pip install sentence-transformers"
            )
            return False
        except Exception as exc:
            logger.warning("Model load failed (%s) — degrading to rapidfuzz only", exc)
            return False

    def _encode_products_sync(self, texts: list[str]) -> np.ndarray:
        """Encode product texts with bi-encoder (runs in thread pool)."""
        embeddings = self._bi_encoder.encode(
            texts,
            batch_size=256,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2-normalised → cosine = dot product
        )
        return embeddings.astype(np.float32)

    def _encode_query_sync(self, query: str) -> np.ndarray:
        """Encode a single query (runs in thread pool)."""
        vec = self._bi_encoder.encode(
            [query],
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return vec[0].astype(np.float32)

    def _cross_encode_sync(
        self,
        query: str,
        candidate_texts: list[str],
    ) -> list[float]:
        """Score query-candidate pairs with cross-encoder (runs in thread pool)."""
        pairs = [[query, text] for text in candidate_texts]
        scores = self._cross_encoder.predict(pairs, show_progress_bar=False)
        # CrossEncoder returns raw logits; sigmoid to [0, 1] range
        import math
        return [1.0 / (1.0 + math.exp(-float(s))) for s in scores]

    # ------------------------------------------------------------------
    # Index building
    # ------------------------------------------------------------------

    async def build_index(self, products: list["Product"]) -> None:
        """Build the retrieval index from the product catalog.

        Steps:
        1. Load bi-encoder and cross-encoder models
        2. Encode all product texts into 384-dim vectors
        3. Store vectors for cosine similarity at query time

        Takes ~30-60s on first run (model downloads + encoding).
        Subsequent runs: ~10-15s (models cached by sentence-transformers).
        """
        if not settings.semantic_search_enabled:
            logger.info("Semantic search disabled — skipping hybrid index build")
            return

        if not products:
            logger.warning("No products to index")
            return

        start = time.perf_counter()

        # Step 1: Load models in thread pool (blocking I/O + CPU)
        loop = asyncio.get_event_loop()
        loaded = await loop.run_in_executor(_executor, self._load_models_sync)
        self._models_loaded = loaded

        if not loaded:
            logger.warning(
                "Hybrid retrieval: models unavailable, will use rapidfuzz fallback for all queries"
            )
            # Still store product metadata for rapidfuzz
            self._product_ids = [p.product_id for p in products]
            self._product_names = [p.name for p in products]
            self._product_texts = [_build_product_text(p) for p in products]
            self._indexed = True
            return

        # Step 2: Build product text corpus
        self._product_ids = [p.product_id for p in products]
        self._product_names = [p.name for p in products]
        self._product_texts = [_build_product_text(p) for p in products]

        # Step 3: Try loading pre-computed embeddings from disk cache
        # Cache is keyed by product count — invalidated if catalog changes
        cache_valid = False
        if _EMBED_CACHE_FILE.exists():
            try:
                cached = np.load(_EMBED_CACHE_FILE, allow_pickle=True)
                cached_ids = cached["product_ids"].tolist()
                cached_embeddings = cached["embeddings"]
                
                # Validate: same products in same order
                if cached_ids == self._product_ids:
                    self._product_embeddings = cached_embeddings
                    cache_valid = True
                    logger.info("Loaded embeddings from disk cache (%d products, %.1fMB)",
                                len(products), cached_embeddings.nbytes / 1024 / 1024)
            except Exception as e:
                logger.warning("Embedding cache invalid or corrupt (%s) — will rebuild", e)

        # Step 4: Encode all products if cache miss (CPU-bound, run in executor)
        if not cache_valid:
            logger.info("Encoding %d products with bi-encoder (first run or cache miss)…", len(products))
            embeddings = await loop.run_in_executor(
                _executor,
                self._encode_products_sync,
                self._product_texts,
            )
            self._product_embeddings = embeddings

            # Save to disk for next restart
            try:
                _EMBED_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                np.savez_compressed(
                    _EMBED_CACHE_FILE,
                    product_ids=np.array(self._product_ids, dtype=object),
                    embeddings=embeddings,
                )
                logger.info("Saved embeddings to disk cache for faster restarts")
            except Exception as e:
                logger.warning("Could not save embedding cache (%s) — will re-encode on next restart", e)

        self._indexed = True
        elapsed = time.perf_counter() - start
        mem_mb = self._product_embeddings.nbytes / 1024 / 1024
        logger.info(
            "Hybrid retrieval index ready: %d products, %.2fs, embeddings=%.1fMB",
            len(products),
            elapsed,
            mem_mb,
        )

    # ------------------------------------------------------------------
    # Stage 1 — Bi-encoder: fast approximate top-K
    # ------------------------------------------------------------------

    async def _bi_encode_search(
        self,
        query: str,
        top_k: int,
    ) -> list[tuple[int, float]]:
        """Return (product_index, cosine_score) for top-K products."""
        if self._product_embeddings is None or self._bi_encoder is None:
            return []

        loop = asyncio.get_event_loop()
        query_vec = await loop.run_in_executor(
            _executor,
            self._encode_query_sync,
            query,
        )

        # Cosine similarity via dot product (embeddings already L2-normalised)
        scores = self._product_embeddings @ query_vec  # shape: (N,)

        # Partial sort — O(N) instead of O(N log N)
        actual_k = min(top_k, len(scores))
        top_indices = np.argpartition(scores, -actual_k)[-actual_k:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

        return [(int(idx), float(scores[idx])) for idx in top_indices]

    # ------------------------------------------------------------------
    # Stage 2 — Cross-encoder: precise re-ranking on shortlist
    # ------------------------------------------------------------------

    async def _cross_encode_rerank(
        self,
        query: str,
        shortlist: list[tuple[int, float]],  # (product_index, bi_score)
        cache_key: str | None = None,
    ) -> list[tuple[int, float]]:
        """Re-rank shortlist with cross-encoder; cache result in Redis."""
        if not shortlist or self._cross_encoder is None:
            return shortlist

        # Check cache first
        if cache_key:
            try:
                from app.repositories import get_cache
                cached = await get_cache().get_cached_response(cache_key)
                if cached:
                    return [(entry["idx"], entry["score"]) for entry in cached]
            except Exception:
                pass  # cache miss or unavailable — continue to inference

        indices = [idx for idx, _ in shortlist]
        candidate_texts = [self._product_texts[idx] for idx in indices]

        loop = asyncio.get_event_loop()
        scores = await loop.run_in_executor(
            _executor,
            self._cross_encode_sync,
            query,
            candidate_texts,
        )

        reranked = sorted(
            zip(indices, scores),
            key=lambda x: x[1],
            reverse=True,
        )

        # Store in cache
        if cache_key:
            try:
                from app.repositories import get_cache
                payload = [{"idx": idx, "score": score} for idx, score in reranked]
                await get_cache().set_cached_response(cache_key, payload, ttl=_CACHE_TTL_SECONDS)
            except Exception:
                pass  # non-critical

        return reranked

    # ------------------------------------------------------------------
    # Stage 3 — Rapidfuzz: typo correction + supplementary candidates
    # ------------------------------------------------------------------

    def _rapidfuzz_search(
        self,
        query: str,
        top_k: int,
        exclude_indices: set[int] | None = None,
    ) -> list[tuple[int, float]]:
        """Return (product_index, fuzzy_score/100) for top-K by fuzzy match.

        Scores are normalised to [0, 1] to match cross-encoder output.
        Safe to call from a thread pool executor.
        """
        from rapidfuzz import fuzz, process as rfprocess

        choices = self._product_names
        expanded_query = _expand_with_synonyms(query)

        raw_matches = rfprocess.extract(
            expanded_query,
            choices,
            scorer=fuzz.WRatio,
            limit=top_k * 3,
            score_cutoff=_FUZZY_MIN_SCORE,
        )

        results: list[tuple[int, float]] = []
        for _name, score, idx in raw_matches:
            if exclude_indices and idx in exclude_indices:
                continue
            results.append((idx, score / 100.0))
            if len(results) >= top_k:
                break

        return results

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        top_k: int | None = None,
        min_score: float = 0.1,
    ) -> list[tuple[str, float]]:
        """Search for products using the hybrid pipeline.

        Args:
            query: Natural language query (need name).
            top_k: Number of final results. Defaults to settings.semantic_top_k.
            min_score: Minimum relevance score (0–1).

        Returns:
            List of (product_id, score) tuples, sorted by score descending.
        """
        if not self._indexed:
            return []

        if top_k is None:
            top_k = settings.semantic_top_k

        expanded_query = _expand_with_synonyms(query)

        # --- Stage 1: Bi-encoder approximate top-K ---
        if self._models_loaded and self._product_embeddings is not None:
            shortlist = await self._bi_encode_search(expanded_query, _BI_ENCODER_SHORTLIST)

            if shortlist:
                # --- Stage 2: Cross-encoder re-rank ---
                shortlist_ids = [self._product_ids[idx] for idx, _ in shortlist]
                ck = _cache_key(expanded_query, shortlist_ids)

                reranked = await self._cross_encode_rerank(expanded_query, shortlist, cache_key=ck)

                # --- Stage 3: Rapidfuzz fallback if top result has low confidence ---
                top_score = reranked[0][1] if reranked else 0.0
                results: list[tuple[str, float]] = []
                seen_indices = {idx for idx, _ in reranked}

                if top_score < _CROSS_ENCODER_LOW_CONF:
                    # Low confidence from cross-encoder — supplement with rapidfuzz (in executor)
                    loop = asyncio.get_event_loop()
                    fuzzy_results = await loop.run_in_executor(
                        _executor, self._rapidfuzz_search, query, top_k, seen_indices
                    )
                    # Blend: use max of cross-encoder and fuzzy scores for overlapping products
                    reranked_dict = {idx: score for idx, score in reranked}
                    for fidx, fscore in fuzzy_results:
                        reranked_dict[fidx] = max(reranked_dict.get(fidx, 0.0), fscore)
                    reranked = sorted(reranked_dict.items(), key=lambda x: x[1], reverse=True)

                for idx, score in reranked[:top_k]:
                    if score >= min_score:
                        results.append((self._product_ids[idx], score))

                return results

        # --- Fallback: rapidfuzz only (models not loaded) ---
        loop = asyncio.get_event_loop()
        fuzzy_raw = await loop.run_in_executor(
            _executor, self._rapidfuzz_search, query, top_k, None
        )
        return [
            (self._product_ids[idx], score)
            for idx, score in fuzzy_raw
            if score >= min_score
        ]

    async def search_with_context(
        self,
        query: str,
        context: str = "",
        top_k: int | None = None,
        min_score: float = 0.1,
    ) -> list[tuple[str, float]]:
        """Search with optional category/context hint for richer matching.

        This is the primary interface used by match_node in the pipeline.
        The context (e.g. category_hint) is appended to the query before
        encoding, nudging the bi-encoder toward the right semantic cluster.

        Args:
            query: Need name (e.g. "paneer").
            context: Category hint (e.g. "dairy").
            top_k: Number of results.
            min_score: Minimum score threshold.

        Returns:
            List of (product_id, score) tuples.
        """
        enriched = f"{query} {context}".strip() if context else query
        return await self.search(enriched, top_k=top_k, min_score=min_score)

    @property
    def is_ready(self) -> bool:
        """Whether the index has been built and is ready for queries."""
        return self._indexed

    @property
    def using_neural_models(self) -> bool:
        """Whether bi-encoder + cross-encoder are active (vs. rapidfuzz-only fallback)."""
        return self._models_loaded and self._product_embeddings is not None


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_hybrid_service: HybridRetrievalService | None = None


def get_semantic_search_service() -> HybridRetrievalService:
    """Return the singleton HybridRetrievalService.

    The function name is intentionally kept as get_semantic_search_service
    to maintain backward compatibility with all existing callers.
    """
    global _hybrid_service
    if _hybrid_service is None:
        _hybrid_service = HybridRetrievalService()
    return _hybrid_service
