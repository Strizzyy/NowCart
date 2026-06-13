"""Catalog loader — reads grocery product CSV and maps to Product models (Requirement 8.1).

Reads the Products.csv dataset (standard CSV format), maps columns to the
Product domain model fields, and returns a list of Product instances.
"""
from __future__ import annotations

import csv
import hashlib
import logging
import re
from pathlib import Path

from app.models.domain import Product

logger = logging.getLogger(__name__)

# Default path to the dataset file (one level above server/)
_DEFAULT_DATASET_PATH = Path(__file__).resolve().parents[3] / "Products.csv"


def _safe_float(value: str, default: float = 0.0) -> float:
    """Convert a string value to float, returning default on failure."""
    if not value or not value.strip():
        return default
    try:
        return float(value.strip())
    except (ValueError, TypeError):
        return default


def _safe_str(value: str | None) -> str:
    """Convert a value to a stripped string."""
    if value is None:
        return ""
    return str(value).strip()


def _generate_product_id(index: int, name: str) -> str:
    """Generate a stable, deterministic product_id from row index + name."""
    raw = f"{index}:{name}"
    return hashlib.md5(raw.encode(), usedforsecurity=False).hexdigest()[:12]


def _parse_unit_from_name(name: str) -> str:
    """Extract a unit hint from the product name (e.g. '1 kg', '500 ml')."""
    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l|ltr|litre|pack|pcs|unit|gm)\b",
        name,
        re.IGNORECASE,
    )
    if match:
        return f"{match.group(1)} {match.group(2).lower()}"
    return ""


def _build_tags(category: str, sub_category: str, product_type: str) -> list[str]:
    """Build search tags from category hierarchy."""
    tags: list[str] = []
    for val in (category, sub_category, product_type):
        if val:
            tags.append(val.lower())
    return tags


def load_catalog(dataset_path: Path | str | None = None) -> list[Product]:
    """Load the grocery catalog from the CSV dataset file.

    Args:
        dataset_path: Optional override path to the CSV file.
                      Defaults to <project_root>/Products.csv

    Returns:
        List of Product domain objects ready for repository seeding.
    """
    path = Path(dataset_path) if dataset_path else _DEFAULT_DATASET_PATH

    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    logger.info("Loading catalog from %s ...", path)

    products: list[Product] = []
    skipped = 0

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=1):
            name = _safe_str(row.get("product"))
            if not name:
                skipped += 1
                continue

            index_val = row.get("index", "")
            try:
                idx = int(index_val)
            except (ValueError, TypeError):
                idx = row_num

            product_id = _generate_product_id(idx, name)

            category = _safe_str(row.get("category"))
            sub_category = _safe_str(row.get("sub_category"))
            brand = _safe_str(row.get("brand"))
            product_type = _safe_str(row.get("type"))

            sale_price = _safe_float(row.get("sale_price", ""))
            market_price = _safe_float(row.get("market_price", ""))
            rating_raw = _safe_float(row.get("rating", ""), default=0.0)
            rating = rating_raw if rating_raw > 0 else None

            unit = _parse_unit_from_name(name)
            tags = _build_tags(category, sub_category, product_type)

            product = Product(
                product_id=product_id,
                name=name,
                brand=brand,
                category=category,
                sub_category=sub_category,
                type=product_type,
                sale_price=sale_price,
                market_price=market_price,
                rating=rating,
                unit=unit,
                in_stock=True,  # stock overrides applied separately
                delivery_eta_min=30,
                tags=tags,
                image_url=None,
            )
            products.append(product)

    logger.info(
        "Catalog loaded: %d products (%d rows skipped)",
        len(products),
        skipped,
    )
    return products
