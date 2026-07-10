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
        {"name": "basmati rice", "quantity": 1, "unit": "kg", "category_hint": "rice"},
        {"name": "chicken", "quantity": 1, "unit": "kg", "category_hint": "meat"},
        {"name": "onion", "quantity": 1, "unit": "kg", "category_hint": "vegetables"},
        {"name": "yogurt", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
        {"name": "biryani masala", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "ghee", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "pasta": [
        {"name": "pasta", "quantity": 1, "unit": "pack", "category_hint": "pasta"},
        {"name": "tomato", "quantity": 1, "unit": "kg", "category_hint": "vegetables"},
        {"name": "cheese", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
        {"name": "olive oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "pancake": [
        {"name": "flour", "quantity": 1, "unit": "kg", "category_hint": "atta & flours"},
        {"name": "milk", "quantity": 1, "unit": "ltr", "category_hint": "dairy"},
        {"name": "eggs", "quantity": 6, "unit": "unit", "category_hint": "eggs"},
        {"name": "butter", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
    ],
    "dal": [
        {"name": "toor dal", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
        {"name": "rice", "quantity": 1, "unit": "pack", "category_hint": "rice"},
        {"name": "onion", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "tomato", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "turmeric", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "cumin", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "ghee", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "rajma": [
        {"name": "rajma", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
        {"name": "rice", "quantity": 1, "unit": "pack", "category_hint": "rice"},
        {"name": "onion", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "tomato", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "rajma masala", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "ginger garlic paste", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "chole": [
        {"name": "chickpeas", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
        {"name": "onion", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "tomato", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "chole masala", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "ginger", "quantity": 1, "unit": "piece", "category_hint": "vegetables"},
        {"name": "oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "sabzi": [
        {"name": "potato", "quantity": 4, "unit": "piece", "category_hint": "vegetables"},
        {"name": "onion", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "tomato", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
        {"name": "turmeric", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "coriander powder", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
    "poha": [
        {"name": "poha", "quantity": 1, "unit": "pack", "category_hint": "breakfast cereals"},
        {"name": "onion", "quantity": 1, "unit": "piece", "category_hint": "vegetables"},
        {"name": "potato", "quantity": 1, "unit": "piece", "category_hint": "vegetables"},
        {"name": "mustard seeds", "quantity": 1, "unit": "pack", "category_hint": "spices"},
        {"name": "curry leaves", "quantity": 1, "unit": "pack", "category_hint": "herbs"},
        {"name": "oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    ],
}

# Generic Indian meal used as budget/dinner/lunch/breakfast fallback
_GENERIC_INDIAN_MEAL: list[dict] = [
    {"name": "basmati rice", "quantity": 1, "unit": "pack", "category_hint": "rice"},
    {"name": "toor dal", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
    {"name": "onion", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
    {"name": "tomato", "quantity": 2, "unit": "piece", "category_hint": "vegetables"},
    {"name": "potato", "quantity": 3, "unit": "piece", "category_hint": "vegetables"},
    {"name": "turmeric", "quantity": 1, "unit": "pack", "category_hint": "spices"},
    {"name": "cumin seeds", "quantity": 1, "unit": "pack", "category_hint": "spices"},
    {"name": "coriander powder", "quantity": 1, "unit": "pack", "category_hint": "spices"},
    {"name": "ginger", "quantity": 1, "unit": "piece", "category_hint": "vegetables"},
    {"name": "oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
    {"name": "chapati flour", "quantity": 1, "unit": "pack", "category_hint": "atta & flours"},
    {"name": "yogurt", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
]

# Goal-based shopping knowledge base — maps wellness/lifestyle goals to curated product needs.
# This enables the "Goal → Buy" flow where users express an intent like "I want to lose weight"
# and the system returns a complete shopping list of relevant products.
_GOAL_BOOK: dict[str, dict] = {
    "lose weight": {
        "goal": "lose weight",
        "needs": [
            {"name": "oats", "quantity": 1, "unit": "pack", "category_hint": "breakfast cereals"},
            {"name": "protein bar", "quantity": 4, "unit": "unit", "category_hint": "snacks"},
            {"name": "green tea", "quantity": 1, "unit": "pack", "category_hint": "tea"},
            {"name": "brown rice", "quantity": 1, "unit": "pack", "category_hint": "rice"},
            {"name": "apple", "quantity": 6, "unit": "unit", "category_hint": "fruits"},
            {"name": "almonds", "quantity": 1, "unit": "pack", "category_hint": "dry fruits"},
        ],
    },
    "gain muscle": {
        "goal": "gain muscle",
        "needs": [
            {"name": "eggs", "quantity": 12, "unit": "unit", "category_hint": "eggs"},
            {"name": "chicken breast", "quantity": 1, "unit": "pack", "category_hint": "meat"},
            {"name": "peanut butter", "quantity": 1, "unit": "pack", "category_hint": "spreads"},
            {"name": "milk", "quantity": 2, "unit": "pack", "category_hint": "dairy"},
            {"name": "banana", "quantity": 6, "unit": "unit", "category_hint": "fruits"},
            {"name": "whey protein", "quantity": 1, "unit": "pack", "category_hint": "health foods"},
        ],
    },
    "eat healthy": {
        "goal": "eat healthy",
        "needs": [
            {"name": "quinoa", "quantity": 1, "unit": "pack", "category_hint": "health foods"},
            {"name": "olive oil", "quantity": 1, "unit": "pack", "category_hint": "edible oil"},
            {"name": "spinach", "quantity": 1, "unit": "pack", "category_hint": "vegetables"},
            {"name": "avocado", "quantity": 3, "unit": "unit", "category_hint": "fruits"},
            {"name": "mixed nuts", "quantity": 1, "unit": "pack", "category_hint": "dry fruits"},
            {"name": "honey", "quantity": 1, "unit": "pack", "category_hint": "spreads"},
        ],
    },
    "boost energy": {
        "goal": "boost energy",
        "needs": [
            {"name": "banana", "quantity": 6, "unit": "unit", "category_hint": "fruits"},
            {"name": "dates", "quantity": 1, "unit": "pack", "category_hint": "dry fruits"},
            {"name": "coffee", "quantity": 1, "unit": "pack", "category_hint": "coffee"},
            {"name": "dark chocolate", "quantity": 2, "unit": "unit", "category_hint": "snacks"},
            {"name": "energy bar", "quantity": 4, "unit": "unit", "category_hint": "snacks"},
            {"name": "orange juice", "quantity": 1, "unit": "pack", "category_hint": "beverages"},
        ],
    },
    "manage diabetes": {
        "goal": "manage diabetes",
        "needs": [
            {"name": "oats", "quantity": 1, "unit": "pack", "category_hint": "breakfast cereals"},
            {"name": "brown bread", "quantity": 1, "unit": "pack", "category_hint": "bakery"},
            {"name": "bitter gourd", "quantity": 1, "unit": "pack", "category_hint": "vegetables"},
            {"name": "fenugreek seeds", "quantity": 1, "unit": "pack", "category_hint": "spices"},
            {"name": "cinnamon", "quantity": 1, "unit": "pack", "category_hint": "spices"},
            {"name": "walnuts", "quantity": 1, "unit": "pack", "category_hint": "dry fruits"},
        ],
    },
    "high protein": {
        "goal": "high protein diet",
        "needs": [
            {"name": "paneer", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
            {"name": "lentils", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
            {"name": "chickpeas", "quantity": 1, "unit": "pack", "category_hint": "dals & pulses"},
            {"name": "tofu", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
            {"name": "greek yogurt", "quantity": 1, "unit": "pack", "category_hint": "dairy"},
            {"name": "soya chunks", "quantity": 1, "unit": "pack", "category_hint": "health foods"},
        ],
    },
}


class MockProvider:
    """Deterministic text provider."""

    name = "mock"

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        text = user.lower()

        # Check goal-based shopping first
        for goal_key, goal_data in _GOAL_BOOK.items():
            if goal_key in text:
                return dict(goal_data)

        # Check recipe book
        for dish, ingredients in _RECIPE_BOOK.items():
            if dish in text:
                return {"dish": dish, "needs": [dict(i) for i in ingredients]}

        # Budget/meal fallback — "dinner", "lunch", "breakfast", "groceries", "meal",
        # or any BUDGET-mode call that didn't match a specific dish above.
        _meal_words = {"dinner", "lunch", "breakfast", "groceries", "meal", "food", "khana", "thali"}
        if any(w in text for w in _meal_words) or "budget" in system.lower():
            return {"dish": "Indian meal", "needs": [dict(i) for i in _GENERIC_INDIAN_MEAL]}

        # Generic fallback: pull noun-ish tokens as single-unit needs so the
        # pipeline still produces a non-empty, deterministic result.
        tokens = [t for t in re.findall(r"[a-z]+", text) if len(t) > 3]
        seen: list[str] = []
        for t in tokens:
            if t not in seen and t not in _STOPWORDS:
                seen.append(t)

        # If we still have nothing, return the generic Indian meal
        if not seen:
            return {"dish": "Indian meal", "needs": [dict(i) for i in _GENERIC_INDIAN_MEAL]}

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
    "tonight", "today", "people", "person",
}
