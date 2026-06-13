"""Seed package — curated grocery catalog + deterministic mock data (Requirements 8.1, 8.2, 8.3).

Provides:
- catalog: load and map products from the grocery dataset
- mock_data: deterministic users and orders for repeatable demos
- stock_overrides: products forced out-of-stock for substitution demo
"""
from app.seed.catalog import load_catalog
from app.seed.mock_data import create_mock_users, create_mock_orders
from app.seed.stock_overrides import STOCK_OVERRIDE_IDS

__all__ = [
    "load_catalog",
    "create_mock_users",
    "create_mock_orders",
    "STOCK_OVERRIDE_IDS",
]
