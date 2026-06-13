"""Shared enumerations used across domain models and the agent pipeline."""
from enum import Enum


class IntentMode(str, Enum):
    """How a user expressed their outcome — selects the engine's entry path."""

    RECIPE = "recipe"      # "I'm making Biryani for 4"
    BUDGET = "budget"      # "₹500, dinner for 4" (constraint-first, A3)
    PHOTO = "photo"        # dish image (B2)
    LINK = "link"          # shared recipe URL / pasted text (B4)
    SOS = "sos"            # emergency kit (D4)
    CART_OP = "cart_op"    # voice follow-up: add/remove/update/total (A2)
    TEXT = "text"          # generic free-text outcome (A1)


class NeedStatus(str, Enum):
    """Lifecycle of a decomposed need as it flows through the pipeline."""

    PENDING = "pending"            # decomposed, not yet matched
    MATCHED = "matched"            # mapped to an in-stock product
    SUBSTITUTED = "substituted"    # original out of stock, swapped (D2)
    UNMATCHED = "unmatched"        # no acceptable product — surfaced, never dropped (1.3)
    NEEDS_CLARIFICATION = "needs_clarification"  # confidence below threshold (C3)
