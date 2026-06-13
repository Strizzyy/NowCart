"""Gemini providers (free-tier): text reasoning + vision.

Gemini's SDK is synchronous, so calls run in a worker thread to stay
non-blocking. Retry with tenacity for transient failures; all paths
degrade gracefully (Requirement 4.5).
"""
import asyncio
import json

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _configure():
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    return genai


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=4), reraise=True)
def _generate_sync(model, content):
    """Synchronous Gemini call wrapped with retry."""
    return model.generate_content(content)


class GeminiProvider:
    """Text reasoning via Gemini (used when LLM_TEXT_PROVIDER=gemini)."""

    name = "gemini"

    def __init__(self) -> None:
        genai = _configure()
        self._model = genai.GenerativeModel(settings.gemini_model)

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        prompt = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}\n\n{user}"
        try:
            resp = await asyncio.to_thread(_generate_sync, self._model, prompt)
            return json.loads(_strip_fences(resp.text))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_json failed, returning empty: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        prompt = f"{system}\n\n{user}"
        try:
            resp = await asyncio.to_thread(_generate_sync, self._model, prompt)
            return resp.text or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_text failed: %s", exc)
            return ""


class GeminiVisionProvider:
    """Vision via Gemini (used when LLM_VISION_PROVIDER=gemini)."""

    name = "gemini"

    def __init__(self) -> None:
        genai = _configure()
        self._model = genai.GenerativeModel(settings.gemini_model)

    async def describe_image(self, image_bytes: bytes, prompt: str) -> dict:
        try:
            part = {"mime_type": "image/jpeg", "data": image_bytes}
            resp = await asyncio.to_thread(_generate_sync, self._model, [prompt, part])
            data = json.loads(_strip_fences(resp.text))
            data.setdefault("degraded", False)
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
