"""Cache layer — Redis with in-memory fallback (Requirement 9.3).

Handles:
- Cart state (session-based)
- Stock overrides (demo control for Requirement 8.3)
- LLM response cache (common outcomes computed once)

Falls back to an in-memory dict when Redis is unavailable or
CACHE_IN_MEMORY=True (default for local dev).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.config import settings
from app.models.domain import Cart

logger = logging.getLogger(__name__)


class _MemoryCache:
    """Simple in-memory fallback when Redis is not available."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._ttls: dict[str, float] = {}  # key -> expiry timestamp

    def _is_expired(self, key: str) -> bool:
        if key in self._ttls:
            if time.time() > self._ttls[key]:
                del self._store[key]
                del self._ttls[key]
                return True
        return False

    async def get(self, key: str) -> str | None:
        if self._is_expired(key):
            return None
        return self._store.get(key)

    async def set(self, key: str, value: str, ttl: int | None = None) -> None:
        self._store[key] = value
        if ttl:
            self._ttls[key] = time.time() + ttl
        elif key in self._ttls:
            del self._ttls[key]

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)
        self._ttls.pop(key, None)


class CacheLayer:
    """Redis cache with transparent in-memory fallback.

    If CACHE_IN_MEMORY=True or Redis connection fails, all ops go to a
    local dict. The interface is identical either way.
    """

    def __init__(self) -> None:
        self._memory = _MemoryCache()
        self._redis: Any | None = None
        self._use_memory = settings.cache_in_memory

    async def _get_redis(self) -> Any | None:
        """Lazily connect to Redis; return None if unavailable."""
        if self._use_memory:
            return None

        if self._redis is not None:
            return self._redis

        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            # Test connectivity
            await self._redis.ping()
            logger.info("Connected to Redis at %s", settings.redis_url)
            return self._redis
        except Exception as exc:
            logger.warning("Redis unavailable (%s), falling back to memory cache", exc)
            self._use_memory = True
            self._redis = None
            return None

    async def _get(self, key: str) -> str | None:
        r = await self._get_redis()
        if r:
            try:
                return await r.get(key)
            except Exception:
                return await self._memory.get(key)
        return await self._memory.get(key)

    async def _set(self, key: str, value: str, ttl: int | None = None) -> None:
        r = await self._get_redis()
        if r:
            try:
                if ttl:
                    await r.set(key, value, ex=ttl)
                else:
                    await r.set(key, value)
                return
            except Exception:
                pass
        await self._memory.set(key, value, ttl)

    async def _delete(self, key: str) -> None:
        r = await self._get_redis()
        if r:
            try:
                await r.delete(key)
                return
            except Exception:
                pass
        await self._memory.delete(key)

    # --- Cart state ---

    async def get_cart(self, session_id: str) -> Cart | None:
        """Retrieve a cart by session ID."""
        raw = await self._get(f"cart:{session_id}")
        if raw is None:
            return None
        return Cart.model_validate_json(raw)

    async def save_cart(self, session_id: str, cart: Cart) -> None:
        """Persist cart state (keyed by session)."""
        await self._set(f"cart:{session_id}", cart.model_dump_json())

    async def delete_cart(self, session_id: str) -> None:
        """Remove a cart (e.g. after checkout)."""
        await self._delete(f"cart:{session_id}")

    # --- Stock override (demo control) ---

    async def get_stock_override(self, product_id: str) -> bool | None:
        """Get the stock override for a product, or None if no override set."""
        raw = await self._get(f"stock:{product_id}")
        if raw is None:
            return None
        return raw == "1"

    async def set_stock_override(self, product_id: str, in_stock: bool) -> None:
        """Force a product in/out of stock for demo purposes."""
        await self._set(f"stock:{product_id}", "1" if in_stock else "0")

    # --- LLM response cache ---

    async def get_cached_response(self, key: str) -> dict | None:
        """Retrieve a cached LLM response by key."""
        raw = await self._get(f"outcome:{key}")
        if raw is None:
            return None
        return json.loads(raw)

    async def set_cached_response(
        self, key: str, value: dict, ttl: int | None = 3600
    ) -> None:
        """Cache an LLM response. Default TTL: 1 hour."""
        await self._set(f"outcome:{key}", json.dumps(value), ttl=ttl)
