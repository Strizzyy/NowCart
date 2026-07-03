"""User domain model — supports personalization and preference tracking."""
from pydantic import BaseModel, Field


class UserLocation(BaseModel):
    """Geographic location for region-aware cart assembly."""

    city: str = ""
    state: str = ""
    # Region: "north" | "south" | "east" | "west" | "central"
    region: str = ""


class User(BaseModel):
    """A platform user with preference signals for personalized matching."""

    user_id: str
    name: str = ""
    email: str = ""
    preferences: list[str] = Field(default_factory=list)  # explicit dietary preferences
    dietary_tags: list[str] = Field(default_factory=list)  # ["vegetarian", "organic", etc.]
    price_tier: str = "mid"  # "budget", "mid", "premium" — inferred from orders
    location: UserLocation = Field(default_factory=UserLocation)  # for region-aware decompose
    age: int | None = None          # used for new-user starter cart (no order history)
    gender: str = ""                # "male" | "female" | "other" | "" — starter cart personalisation
