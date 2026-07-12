"""Schemas for LLM JSON responses — validated once, right at the boundary.

Providers return whatever the model felt like returning: a field can be absent,
explicitly null, the wrong type, or just missing entirely. dict.get(key, default)
only substitutes for an absent key, not an explicit null — the gap that crashed
requests three separate ways this session (a null quantity, a null category_hint,
a null vision field) before each was caught and patched by hand, one call site at
a time. These models coerce every field on the way in, once, so a call site never
has to re-derive "is this field actually usable" logic again.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


def _coerce_str(value: object, default: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else default


def _coerce_float(value: object, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


class DecomposeNeed(BaseModel):
    """One ingredient/item inside a decompose response's "needs" array."""

    name: str = "unknown"
    quantity: float = 1.0
    unit: str = "unit"
    category_hint: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def _v_name(cls, v: object) -> str:
        return _coerce_str(v, "unknown")

    @field_validator("unit", mode="before")
    @classmethod
    def _v_unit(cls, v: object) -> str:
        return _coerce_str(v, "unit")

    @field_validator("category_hint", mode="before")
    @classmethod
    def _v_category_hint(cls, v: object) -> str:
        return _coerce_str(v, "")

    @field_validator("quantity", mode="before")
    @classmethod
    def _v_quantity(cls, v: object) -> float:
        return _coerce_float(v, 1.0)


class DecomposeResult(BaseModel):
    """Response shape for the DECOMPOSE / GOAL / BUDGET / AUGMENT prompts
    (app/agents/nodes.py: decompose_node) — they all return {dish|goal, needs[]}.
    """

    dish: str | None = None
    goal: str | None = None
    needs: list[DecomposeNeed] = Field(default_factory=list)

    @field_validator("needs", mode="before")
    @classmethod
    def _v_needs(cls, v: object) -> list:
        return v if isinstance(v, list) else []


class ReplanClassification(BaseModel):
    """Response shape for the refine-cart feedback classifier
    (app/agents/nodes.py: replan_node)."""

    wants_removal: bool = False
    wants_cheaper: bool = False
    wants_additive: bool = False
    wants_rebuild: bool = False
    excluded_items: list[str] = Field(default_factory=list)
    dietary_tags: list[str] = Field(default_factory=list)
    swap: dict[str, str] = Field(default_factory=dict)

    @field_validator("wants_removal", "wants_cheaper", "wants_additive", "wants_rebuild", mode="before")
    @classmethod
    def _v_bool(cls, v: object) -> bool:
        return bool(v)

    @field_validator("excluded_items", "dietary_tags", mode="before")
    @classmethod
    def _v_str_list(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [s.lower().strip() for s in v if isinstance(s, str) and s.strip()]

    @field_validator("swap", mode="before")
    @classmethod
    def _v_swap(cls, v: object) -> dict[str, str]:
        if not isinstance(v, dict):
            return {}
        result: dict[str, str] = {}
        for k, val in v.items():
            key = k.lower().strip() if isinstance(k, str) else ""
            replacement = val.lower().strip() if isinstance(val, str) else ""
            if key and replacement:
                result[key] = replacement
        return result


class VisionResult(BaseModel):
    """Response shape for vision.describe_image (app/services/vision_service.py)."""

    dish: str = "unknown dish"
    ingredients: list[str] = Field(default_factory=list)
    servings_estimate: int = 2
    cuisine: str = ""
    degraded: bool = False

    @field_validator("dish", mode="before")
    @classmethod
    def _v_dish(cls, v: object) -> str:
        return _coerce_str(v, "unknown dish")

    @field_validator("cuisine", mode="before")
    @classmethod
    def _v_cuisine(cls, v: object) -> str:
        return _coerce_str(v, "")

    @field_validator("ingredients", mode="before")
    @classmethod
    def _v_ingredients(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [s.strip() for s in v if isinstance(s, str) and s.strip()]

    @field_validator("servings_estimate", mode="before")
    @classmethod
    def _v_servings(cls, v: object) -> int:
        if v is None:
            return 2
        try:
            n = int(v)  # type: ignore[arg-type]
            return n if n > 0 else 2
        except (TypeError, ValueError):
            return 2

    @field_validator("degraded", mode="before")
    @classmethod
    def _v_degraded(cls, v: object) -> bool:
        return bool(v)
