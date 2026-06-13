"""Seed script — runnable as `python -m app.seed` (Requirements 8.1, 8.2, 8.3).

Loads the curated grocery catalog, creates deterministic mock users and orders,
applies stock overrides, and stores everything in the configured repository.

Exit 0 on success, non-zero on failure.
"""
from __future__ import annotations

import asyncio
import logging
import sys
import time

from app.seed.catalog import load_catalog
from app.seed.mock_data import create_mock_users, create_mock_orders
from app.seed.stock_overrides import get_override_product_ids


logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("app.seed")


async def _run_seed() -> None:
    """Execute the full seed pipeline."""
    from app.repositories import get_repository, get_cache

    repo = get_repository()
    cache = get_cache()

    start = time.perf_counter()

    # 1. Load product catalog from dataset
    logger.info("=== Step 1: Loading product catalog ===")
    products = load_catalog()
    logger.info("  Loaded %d products from dataset", len(products))

    # 2. Apply stock overrides (mark some products out-of-stock)
    logger.info("=== Step 2: Applying stock overrides ===")
    all_product_ids = [p.product_id for p in products]
    override_ids = get_override_product_ids(all_product_ids)

    override_set = set(override_ids)
    for product in products:
        if product.product_id in override_set:
            product.in_stock = False

    logger.info("  Marked %d products as out-of-stock", len(override_ids))

    # 3. Store products in repository
    logger.info("=== Step 3: Storing products in repository ===")
    await repo.bulk_upsert_products(products)
    logger.info("  Stored %d products", len(products))

    # 4. Register stock overrides in cache
    logger.info("=== Step 4: Registering stock overrides in cache ===")
    for pid in override_ids:
        await cache.set_stock_override(pid, False)
    logger.info("  Registered %d stock overrides in cache", len(override_ids))

    # 5. Create and store mock users
    logger.info("=== Step 5: Creating mock users ===")
    users = create_mock_users()
    for user in users:
        await repo.upsert_user(user)
    logger.info("  Created %d users", len(users))

    # 6. Create and store mock orders
    logger.info("=== Step 6: Creating mock orders ===")
    orders = create_mock_orders(all_product_ids)
    for order in orders:
        await repo.upsert_order(order)
    logger.info("  Created %d orders", len(orders))

    elapsed = time.perf_counter() - start

    # Summary
    print("\n" + "=" * 50)
    print("  SEED COMPLETE")
    print("=" * 50)
    print(f"  Products loaded:    {len(products)}")
    print(f"  Users created:      {len(users)}")
    print(f"  Orders created:     {len(orders)}")
    print(f"  Stock overrides:    {len(override_ids)}")
    print(f"  Time elapsed:       {elapsed:.2f}s")
    print(f"  Backend:            {type(repo).__name__}")
    print("=" * 50 + "\n")


def main() -> None:
    """Entry point for `python -m app.seed`."""
    try:
        asyncio.run(_run_seed())
    except Exception as exc:
        logger.error("Seed failed: %s", exc, exc_info=True)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
