"""User domain model — deterministic mock users for demo (Requirement 8.2)."""
from pydantic import BaseModel, Field


class User(BaseModel):
    """A platform user. Seeded deterministically for repeatable demos."""

    user_id: str
    name: str = ""
    email: str = ""
    preferences: list[str] = Field(default_factory=list)
