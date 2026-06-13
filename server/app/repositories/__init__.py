"""Repositories — data access behind one interface (Requirement 8.4, 9.3).

Exports:
- get_repository() — returns Memory or DynamoDB repo based on settings.
- get_cache()      — returns the Redis/memory cache layer.
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.repositories.base import Repository
from app.repositories.cache import CacheLayer
from app.repositories.memory import MemoryRepository


@lru_cache
def get_repository() -> Repository:
    """Factory: return the configured repository backend.

    Returns MemoryRepository by default; DynamoDBRepository when
    DATA_BACKEND=dynamodb.
    """
    if settings.data_backend == "dynamodb":
        from app.repositories.dynamodb import DynamoDBRepository

        return DynamoDBRepository()  # type: ignore[return-value]
    return MemoryRepository()  # type: ignore[return-value]


@lru_cache
def get_cache() -> CacheLayer:
    """Factory: return the singleton cache layer (Redis + memory fallback)."""
    return CacheLayer()


__all__ = [
    "Repository",
    "MemoryRepository",
    "CacheLayer",
    "get_repository",
    "get_cache",
]
