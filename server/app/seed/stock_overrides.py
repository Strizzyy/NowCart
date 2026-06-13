"""Stock overrides — products forced out-of-stock for demo (Requirement 8.3).

These product indices (from the catalog) are marked as out-of-stock to
demonstrate the substitution flow. The seed script uses these to set
in_stock=False on specific products and register cache overrides.

The override list is deterministic so demos are repeatable.
"""
from __future__ import annotations

# Indices into the loaded catalog list — these products will be forced out-of-stock.
# Chosen to cover a mix of categories for substitution demo coverage.
STOCK_OVERRIDE_INDICES: list[int] = [
    5,    # A staple item — triggers substitution in meal outcomes
    15,   # A beverage — tests drink replacement
    25,   # A snack — tests snack swap
    50,   # A protein source — tests dietary substitution
    75,   # A dairy product — tests brand swap
    100,  # A health food — tests organic alternative
    200,  # A household item — tests category match
    400,  # A pantry staple — tests bulk item swap
]

# Populated at seed time from the actual catalog product_ids
STOCK_OVERRIDE_IDS: list[str] = []


def get_override_product_ids(all_product_ids: list[str]) -> list[str]:
    """Return the product IDs that should be forced out-of-stock.

    Args:
        all_product_ids: Complete list of product IDs from the loaded catalog.

    Returns:
        Subset of product_ids to mark as out-of-stock for demo.
    """
    override_ids: list[str] = []
    for idx in STOCK_OVERRIDE_INDICES:
        if idx < len(all_product_ids):
            override_ids.append(all_product_ids[idx])
    return override_ids
