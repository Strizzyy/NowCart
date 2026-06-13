"""Provider protocols — the only LLM surface the rest of the app sees."""
from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMProvider(Protocol):
    """Text reasoning provider (Groq today, Bedrock-ready later)."""

    name: str

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        """Return a parsed JSON object. Implementations must never raise on
        malformed model output — they fall back to {} so callers can degrade."""
        ...

    async def complete_text(self, system: str, user: str) -> str:
        """Return a plain-text completion."""
        ...


@runtime_checkable
class VisionProvider(Protocol):
    """Image understanding provider (Gemini today)."""

    name: str

    async def describe_image(self, image_bytes: bytes, prompt: str) -> dict:
        """Return a structured description, e.g. {dish, ingredients[]}.
        Must signal failure via {'degraded': True} rather than raising (4.5)."""
        ...
