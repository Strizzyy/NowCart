"""Groq text provider (free-tier). JSON mode + retry, with safe degradation.

Uses Groq's fast inference API (Llama 3.3 70B) for:
- Recipe decomposition (outcome engine)
- URL/recipe content extraction (share service)
- Emergency kit generation (SOS service)
- Confidence scoring and substitution reasoning
"""
import json

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GroqProvider:
    name = "groq"

    def __init__(self) -> None:
        # Imported lazily so the app boots even if the SDK/key is absent.
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=settings.groq_api_key)
        self._model = settings.groq_model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=4), reraise=True)
    async def _chat(self, system: str, user: str, json_mode: bool, max_tokens: int = 2048) -> str:
        kwargs: dict = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await self._client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        """Return a parsed JSON object from Groq.

        Uses JSON mode for reliable structured output.
        Falls back to {} on any failure to keep the pipeline running.
        """
        primed = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}"
        try:
            raw = await self._chat(primed, user, json_mode=True)
            return json.loads(raw)
        except Exception as exc:  # noqa: BLE001 — degrade, never crash the pipeline
            logger.warning("Groq complete_json failed, returning empty: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        """Return a plain-text completion from Groq.

        Used for recipe extraction from URLs, text summarization, etc.
        Falls back to empty string on failure.
        """
        try:
            return await self._chat(system, user, json_mode=False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Groq complete_text failed: %s", exc)
            return ""
