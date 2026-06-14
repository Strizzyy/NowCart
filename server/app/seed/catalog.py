"""Catalog loader — reads BigBasket grocery dataset and maps to Product models (Requirement 8.1).

Reads the BigBasket dataset (CSV or Excel format, ~18k products), maps columns
to the Product domain model fields, and returns a list of Product instances.
Each row includes brand, product name, quantity/unit, price, MRP, category,
sub-category, and a product image URL.

Supports both .csv and .xlsx formats — auto-detects by file extension.
"""
from __future__ import annotations

import csv
import hashlib
import logging
import random
import re
from pathlib import Path

from app.models.domain import Product

logger = logging.getLogger(__name__)

# Default path to the dataset file (one level above server/)
# Tries CSV first, falls back to XLSX
_DEFAULT_CSV_PATH = Path(__file__).resolve().parents[3] / "BigBasket.csv"
_DEFAULT_XLSX_PATH = Path(__file__).resolve().parents[3] / "BigBasket.xlsx"


def _get_default_dataset_path() -> Path:
    """Return the first existing dataset path (CSV preferred over XLSX)."""
    if _DEFAULT_CSV_PATH.exists():
        return _DEFAULT_CSV_PATH
    if _DEFAULT_XLSX_PATH.exists():
        return _DEFAULT_XLSX_PATH
    # Fall back to CSV path for error messaging
    return _DEFAULT_CSV_PATH


def _safe_float(value: object, default: float = 0.0) -> float:
    """Convert a value to float, returning default on failure."""
    if value is None:
        return default
    raw = str(value).strip()
    if not raw:
        return default
    try:
        return float(raw)
    except (ValueError, TypeError):
        return default


def _safe_str(value: object) -> str:
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


def _build_tags(category: str, sub_category: str) -> list[str]:
    """Build search tags from category hierarchy."""
    tags: list[str] = []
    for val in (category, sub_category):
        if val:
            tags.append(val.lower())
    return tags


# --- Random rating & description generation ---

_RATING_CHOICES = [round(3.0 + i * 0.1, 1) for i in range(21)]  # 3.0 to 5.0

_DESCRIPTIONS: dict[str, list[str]] = {
    "fruits vegetables": [
        "Farm-fresh produce sourced directly from local growers for maximum freshness and nutrition.",
        "Handpicked and carefully sorted to bring you the finest quality fruits and vegetables.",
        "Naturally grown, rich in vitamins and minerals — a healthy addition to your daily meals.",
        "Crisp, vibrant, and full of flavour. Perfect for salads, cooking, and snacking.",
        "Sustainably harvested produce that supports local farmers and tastes incredible.",
    ],
    "foodgrains oil masala": [
        "Premium quality grains and spices to elevate your everyday cooking.",
        "Sourced from the finest farms, ensuring authentic taste and aroma in every dish.",
        "Essential pantry staples — carefully processed and packed for lasting freshness.",
        "Traditional flavours meet modern quality standards. Perfect for Indian cuisine.",
        "Stone-ground and minimally processed to retain natural nutrients and rich taste.",
    ],
    "snacks branded foods": [
        "Irresistible snacks crafted with quality ingredients for guilt-free munching.",
        "Perfect for tea-time, parties, or whenever you crave something delicious.",
        "Crunchy, flavourful, and made with care — your go-to snack companion.",
        "A delightful mix of taste and nutrition that the whole family will love.",
        "Freshly packed to lock in crunch and flavour. Great for on-the-go snacking.",
    ],
    "beverages": [
        "Refresh and rejuvenate with our carefully curated selection of beverages.",
        "From energising teas to refreshing juices — there's something for every mood.",
        "Premium blends crafted for a smooth, satisfying drinking experience.",
        "Stay hydrated and energised throughout the day with these delicious drinks.",
        "Natural ingredients, bold flavours, and zero compromise on quality.",
    ],
    "bakery cakes dairy": [
        "Freshly baked with love — soft, fluffy, and absolutely delicious.",
        "Made from the finest dairy and baking ingredients for an indulgent treat.",
        "Perfect for breakfast, dessert, or a mid-day pick-me-up.",
        "Rich, creamy, and crafted to satisfy your sweet cravings.",
        "Artisan quality baked goods and dairy products delivered fresh to your door.",
    ],
    "beauty hygiene": [
        "Gentle on your skin, powerful in results. Elevate your daily care routine.",
        "Formulated with nourishing ingredients for healthy, radiant skin and hair.",
        "Dermatologically tested and crafted for everyday freshness and confidence.",
        "Premium personal care essentials that pamper you from head to toe.",
        "A blend of natural extracts and modern science for effective self-care.",
    ],
    "cleaning household": [
        "Powerful cleaning solutions that keep your home spotless and germ-free.",
        "Tough on dirt, gentle on surfaces — trusted household essentials.",
        "Keep your living spaces fresh, hygienic, and beautifully maintained.",
        "Eco-friendly formulas that deliver a deep clean without harsh chemicals.",
        "Essential home care products designed for everyday convenience and effectiveness.",
    ],
    "kitchen garden pets": [
        "Durable, practical, and designed to make your kitchen and garden life easier.",
        "High-quality tools and accessories for cooking, gardening, and pet care.",
        "Smart solutions for a well-organised kitchen and a happy home.",
        "Built to last — functional essentials your household can rely on daily.",
        "Everything you need for the kitchen, the garden, and your furry friends.",
    ],
    "eggs meat fish": [
        "Fresh, protein-rich, and sourced from trusted farms and fisheries.",
        "Hygienically processed and packed to preserve freshness and nutrition.",
        "Premium cuts and selections for wholesome, delicious meals.",
        "Farm-to-table quality — tender, flavourful, and ready to cook.",
        "Carefully inspected for quality so you get the very best every time.",
    ],
    "baby care": [
        "Gentle, safe, and specially formulated for your little one's delicate needs.",
        "Trusted by parents — premium baby essentials for everyday care and comfort.",
        "Dermatologically tested and free from harmful chemicals. Only the best for baby.",
        "Soft, soothing, and designed with love for your baby's wellbeing.",
        "Expert-recommended products that keep your baby happy, healthy, and protected.",
    ],
    "gourmet world food": [
        "Explore global flavours with our curated selection of gourmet ingredients.",
        "Authentic international cuisine essentials — bring the world to your kitchen.",
        "Premium imported ingredients for the adventurous home chef.",
        "Discover new tastes and elevate your cooking with artisan-quality foods.",
        "From exotic spices to fine chocolates — indulge in the best the world offers.",
    ],
}

_DEFAULT_DESCRIPTIONS = [
    "A quality product carefully selected to meet your everyday needs.",
    "Trusted by thousands of happy customers. Great value for money.",
    "Premium quality with attention to detail in every aspect.",
    "An excellent choice that combines quality, convenience, and affordability.",
    "Thoughtfully crafted to deliver the best experience possible.",
]


def _random_rating(seed: int) -> float:
    """Pick a deterministic random rating between 3.0 and 5.0."""
    rng = random.Random(seed)
    return rng.choice(_RATING_CHOICES)


def _random_description(seed: int, category: str) -> str:
    """Pick a deterministic random description based on category."""
    rng = random.Random(seed)
    pool = _DESCRIPTIONS.get(category.lower(), _DEFAULT_DESCRIPTIONS)
    return rng.choice(pool)


def load_catalog(dataset_path: Path | str | None = None) -> list[Product]:
    """Load the grocery catalog from the BigBasket dataset file.

    Supports both .csv and .xlsx formats (auto-detected by extension).

    Args:
        dataset_path: Optional override path to the dataset file.
                      Defaults to <project_root>/BigBasket.csv (or .xlsx)

    Returns:
        List of Product domain objects ready for repository seeding.
    """
    path = Path(dataset_path) if dataset_path else _get_default_dataset_path()

    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    logger.info("Loading catalog from %s ...", path)

    if path.suffix.lower() == ".csv":
        rows = _read_csv(path)
    else:
        rows = _read_xlsx(path)

    products: list[Product] = []
    skipped = 0

    for row_num, row in enumerate(rows, start=1):
        name = _safe_str(row[2])  # Product column
        if not name:
            skipped += 1
            continue

        # Use the index column if available, else fall back to row_num
        index_val = row[0]
        try:
            idx = int(index_val)
        except (ValueError, TypeError):
            idx = row_num

        product_id = _generate_product_id(idx, name)

        brand = _safe_str(row[1])          # Brand
        quantity = _safe_str(row[3])       # Quantity (e.g. "1 Kg Pouch", "500 ml")
        category = _safe_str(row[6])       # Category
        sub_category = _safe_str(row[7])   # Sub-Category
        image_url = _safe_str(row[8]) if len(row) > 8 else ""  # image_small URL

        sale_price = _safe_float(row[4])   # Price (selling price)
        market_price = _safe_float(row[5]) # MRP

        # Use the Quantity column directly as unit; also try to parse from name
        unit = quantity if quantity else _parse_unit_from_name(name)

        tags = _build_tags(category, sub_category)

        product = Product(
            product_id=product_id,
            name=name,
            brand=brand,
            category=category,
            sub_category=sub_category,
            type="",  # BigBasket dataset doesn't have a type column
            sale_price=sale_price,
            market_price=market_price,
            rating=_random_rating(idx),
            unit=unit,
            in_stock=True,  # stock overrides applied separately
            delivery_eta_min=30,
            tags=tags,
            image_url=image_url if image_url else None,
            description=_random_description(idx + 9999, category),
        )
        products.append(product)

    logger.info(
        "Catalog loaded: %d products (%d rows skipped)",
        len(products),
        skipped,
    )
    return products


def _read_csv(path: Path) -> list[list]:
    """Read CSV file and return rows (list of lists), skipping the header."""
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            rows.append(row)
    return rows


def _read_xlsx(path: Path) -> list[list]:
    """Read XLSX file and return rows (list of lists), skipping the header."""
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        rows.append(list(row))
    wb.close()
    return rows
