"""Seed script — loads BigBasket.xlsx into DynamoDB (local or AWS).

Run standalone:
    python -m app.seed.seed_dynamodb

Or called from the lifespan hook when DATA_BACKEND=dynamodb and tables are empty.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Ensure the server package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.config import settings  # noqa: E402
from app.repositories.dynamodb import DynamoDBRepository  # noqa: E402
from app.seed.catalog import load_catalog  # noqa: E402
from app.seed.mock_data import create_mock_users, create_mock_orders  # noqa: E402
from app.seed.stock_overrides import get_override_product_ids  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)


async def seed_dynamodb(force: bool = False) -> None:
    """Load BigBasket.xlsx products + mock users/orders into DynamoDB.

    Args:
        force: If True, re-seed even if products already exist.
    """
    repo = DynamoDBRepository()
    await repo.create_tables_if_not_exist()

    # Check if already seeded (quick probe)
    if not force:
        existing = await repo.list_products(category=None, search=None)
        if existing:
            logger.info("DynamoDB already seeded (%d products found). Skipping.", len(existing))
            return

    # Load catalog from Excel
    logger.info("Loading catalog from BigBasket.xlsx...")
    products = load_catalog()

    # Apply stock overrides
    override_ids = get_override_product_ids([p.product_id for p in products])
    override_set = set(override_ids)
    for p in products:
        if p.product_id in override_set:
            p.in_stock = False

    # Batch write products
    logger.info("Writing %d products to DynamoDB...", len(products))
    await repo.bulk_upsert_products(products)
    logger.info("Products seeded successfully.")

    # Seed users
    users = create_mock_users()
    for user in users:
        await repo.upsert_user(user)
    logger.info("Seeded %d users.", len(users))

    # Seed orders
    orders = create_mock_orders([p.product_id for p in products])
    for order in orders:
        await repo.upsert_order(order)
    logger.info("Seeded %d orders.", len(orders))

    logger.info("DynamoDB seed complete!")


async def is_dynamodb_seeded() -> bool:
    """Quick check: does the Products table have any data?"""
    try:
        repo = DynamoDBRepository()
        await repo.create_tables_if_not_exist()
        existing = await repo.list_products(category=None, search=None)
        return len(existing) > 0
    except Exception:
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed DynamoDB with BigBasket catalog")
    parser.add_argument("--force", action="store_true", help="Re-seed even if data exists")
    args = parser.parse_args()

    asyncio.run(seed_dynamodb(force=args.force))
