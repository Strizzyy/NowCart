"""Gemini providers (free-tier): text reasoning + vision.

Supports round-robin key rotation across multiple Gemini API keys to
distribute rate-limit load evenly (same pattern as GroqProvider).

Gemini's SDK is synchronous, so calls run in a worker thread to stay
non-blocking. Retry with tenacity for transient failures; all paths
degrade gracefully (Requirement 4.5).
"""
import asyncio
import itertools
import json

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _create_model(api_key: str, model_name: str):
    """Configure genai with a specific key and return a GenerativeModel."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=4), reraise=True)
def _generate_sync(model, content):
    """Synchronous Gemini call wrapped with retry."""
    return model.generate_content(content)


class GeminiProvider:
    """Text reasoning via Gemini with multi-key rotation.

    Cycles through GEMINI_API_KEYS (comma-separated) round-robin to
    distribute rate limits across multiple free-tier keys.
    """

    name = "gemini"

    def __init__(self) -> None:
        keys = settings.gemini_api_key_list
        if not keys:
            raise ValueError("No Gemini API keys configured. Set GEMINI_API_KEYS or GEMINI_API_KEY in .env")

        self._models = [_create_model(k, settings.gemini_model) for k in keys]
        self._model_cycle = itertools.cycle(self._models)
        logger.info("GeminiProvider initialized with %d API key(s), model=%s", len(keys), settings.gemini_model)

    def _next_model(self):
        """Get the next model in the round-robin rotation."""
        return next(self._model_cycle)

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        prompt = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}\n\n{user}"
        model = self._next_model()
        try:
            resp = await asyncio.to_thread(_generate_sync, model, prompt)
            return json.loads(_strip_fences(resp.text))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_json failed, returning empty: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        prompt = f"{system}\n\n{user}"
        model = self._next_model()
        try:
            resp = await asyncio.to_thread(_generate_sync, model, prompt)
            return resp.text or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_text failed: %s", exc)
            return ""


class GeminiVisionProvider:
    """Vision via Gemini with multi-key rotation.

    Handles food/dish identification from photos for the "Show It" feature.
    Returns structured JSON with dish name, ingredients, and metadata.
    """

    name = "gemini"

    def __init__(self) -> None:
        keys = settings.gemini_api_key_list
        if not keys:
            raise ValueError("No Gemini API keys configured for vision.")

        self._models = [_create_model(k, settings.gemini_model) for k in keys]
        self._model_cycle = itertools.cycle(self._models)
        logger.info("GeminiVisionProvider initialized with %d API key(s)", len(keys))

    def _next_model(self):
        """Get the next model in the round-robin rotation."""
        return next(self._model_cycle)

    async def describe_image(self, image_bytes: bytes, prompt: str) -> dict:
        """Analyze an image and return structured dish/ingredient data.

        Args:
            image_bytes: Raw image data (JPEG/PNG).
            prompt: Analysis prompt requesting specific output format.

        Returns:
            Dict with dish, ingredients, servings_estimate, cuisine.
            Returns {'degraded': True} if analysis fails.
        """
        if not image_bytes:
            return {"dish": None, "ingredients": [], "degraded": True}

        try:
            # Detect MIME type from bytes
            mime_type = "image/jpeg"
            if image_bytes[:4] == b"\x89PNG":
                mime_type = "image/png"
            elif image_bytes[:4] == b"RIFF":
                mime_type = "image/webp"

            part = {"mime_type": mime_type, "data": image_bytes}

            # Enhanced prompt for reliable JSON output
            full_prompt = (
                f"{prompt}\n\n"
                "IMPORTANT: Return ONLY valid JSON, no markdown fences, no extra text."
            )

            model = self._next_model()
            resp = await asyncio.to_thread(_generate_sync, model, [full_prompt, part])
            data = json.loads(_strip_fences(resp.text))
            data.setdefault("degraded", False)
            data.setdefault("dish", "unknown dish")
            data.setdefault("ingredients", [])
            return data
        except Exception as exc:  # noqa: BLE001 — vision down → degrade (4.5)
            logger.warning("Gemini vision failed, degrading: %s", exc)
            return {"dish": None, "ingredients": [], "degraded": True}


def _strip_fences(text: str) -> str:
    """Gemini often wraps JSON in ```json fences — strip them before parsing."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t
        t = t.rsplit("```", 1)[0]
    return t.strip()
