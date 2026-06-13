"""Need domain model — a structured item requirement decomposed from an outcome."""
from pydantic import BaseModel, Field

from app.models.domain.enums import NeedStatus


class Need(BaseModel):
    """One ingredient/item the outcome implies (Requirement 1.1).

    A need is never silently dropped: it ends as MATCHED, SUBSTITUTED, or
    UNMATCHED, and that status is always surfaced (Requirement 1.3).
    """

    name: str
    quantity: float = 1.0
    unit: str = "unit"
    category_hint: str = ""
    matched_product_id: str | None = None
    status: NeedStatus = NeedStatus.PENDING
    note: str = ""
