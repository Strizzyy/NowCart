"""User domain model — supports personalization and preference tracking."""
from pydantic import BaseModel, Field


class User(BaseModel):
    """A platform user with preference signals for personalized matching."""

    user_id: str
    name: str = ""
    email: str = ""
    preferences: list[str] = Field(default_factory=list)  # explicit dietary preferences
    dietary_tags: list[str] = Field(default_factory=list)  # ["vegetarian", "organic", etc.]
    price_tier: str = "mid"  # "budget", "mid", "premium" — inferred from orders
