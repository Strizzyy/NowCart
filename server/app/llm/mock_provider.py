"""Deterministic, key-free providers.

These let the whole app run end-to-end with no API keys and produce identical
output for identical input (Requirement 8.2 / deterministic-demo property).
Business logic stays in services/agents — this only returns plausible,
stable structured data so the pipeline has something to chew on.
"""
import re

from app.core.logging import get_logger

logger = get_logger(__name__)

# Tiny built-in recipe knowledge base for repeatable demos. Real decomposition
# happens via Groq when a key is present; this keeps the mock path believable.
_RECIPE_BOOK: dict[str, list[dict]] = {
    "biryani": [
        {"name": "basmati rice", "quantity": 500, "unit": "g", "category_hint": "rice"},
        {"name": "chicken", "quantity": 750, "unit": "g", "category_hint": "meat"},
        {"name": "onion", "quantity": 3, "unit": "unit", "category_hint": "vegetables"},
        {"name": "yogurt", "quantity": 200, "unit": "g", "category_hint": "dairy"},
        {"name": "biryani masala", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "ghee", "quantity": 100, "unit": "g", "category_hint": "edible oil"},
    ],
    "pasta": [
        {"name": "pasta", "quantity": 500, "unit": "g", "category_hint": "pasta"},
        {"name": "tomato", "quantity": 4, "unit": "unit", "category_hint": "vegetables"},
        {"name": "cheese", "quantity": 200, "unit": "g", "category_hint": "dairy"},
        {"name": "olive oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "pancake": [
        {"name": "flour", "quantity": 300, "unit": "g", "category_hint": "atta & flours"},
        {"name": "milk", "quantity": 500, "unit": "ml", "category_hint": "dairy"},
        {"name": "eggs", "quantity": 6, "unit": "unit", "category_hint": "eggs"},
        {"name": "butter", "quantity": 100, "unit": "g", "category_hint": "dairy"},
    ],
}


class MockProvider:
    """Deterministic text provider."""

    name = "mock"

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        text = user.lower()
        for dish, ingredients in _RECIPE_BOOK.items():
            if dish in text:
                return {"dish": dish, "needs": [dict(i) for i in ingredients]}

        # Generic fallback: pull noun-ish tokens as single-unit needs so the
        # pipeline still produces a non-empty, deterministic result.
        tokens = [t for t in re.findall(r"[a-z]+", text) if len(t) > 3]
        seen: list[str] = []
        for t in tokens:
            if t not in seen and t not in _STOPWORDS:
                seen.append(t)
        needs = [
            {"name": t, "quantity": 1, "unit": "unit", "category_hint": ""}
            for t in seen[:6]
        ]
        return {"dish": None, "needs": needs}

    async def complete_text(self, system: str, user: str) -> str:
        return user.strip()


class MockVisionProvider:
    """Deterministic vision provider — returns a stable fake dish."""

    name = "mock"

    async def describe_image(self, image_bytes: bytes, prompt: str) -> dict:
        # Deterministic: key off image size so identical bytes → identical dish.
        dish = "pasta" if (len(image_bytes) % 2 == 0) else "biryani"
        return {
            "dish": dish,
            "ingredients": [i["name"] for i in _RECIPE_BOOK[dish]],
            "degraded": False,
        }


_STOPWORDS = {
    "make", "making", "want", "need", "please", "would", "like", "some",
    "with", "from", "into", "have", "this", "that", "give", "buy", "order",
    "dinner", "lunch", "breakfast", "tonight", "today", "people", "person",
}
