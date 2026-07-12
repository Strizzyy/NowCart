"""Gemini providers (free-tier): text reasoning + vision.

Supports round-robin key rotation across multiple Gemini API keys to
distribute rate-limit load evenly (same pattern as GroqProvider). If a key
is rejected (quota exhausted, project restricted, etc.) the next key in
rotation is tried automatically before giving up.

Uses the google-genai SDK's per-instance Client, not the legacy
google-generativeai module. The legacy SDK's genai.configure() sets
process-wide global state rather than per-model state, so pre-building
multiple "rotated" models each silently shared whichever key was configured
last — breaking rotation and racing under concurrent requests. Client
instances here are fully isolated per API key.
"""
import asyncio
import itertools
import json

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# No per-call timeout existed before — a merely-slow (not erroring) response was
# awaited indefinitely. This bounds each key attempt so a hung call fails fast
# and rotates to the next key instead of blocking the whole request.
_VISION_TIMEOUT_SECONDS = 20


class GeminiProvider:
    """Text reasoning via Gemini with multi-key rotation."""

    name = "gemini"

    def __init__(self) -> None:
        keys = settings.gemini_api_key_list
        if not keys:
            raise ValueError("No Gemini API keys configured. Set GEMINI_API_KEYS or GEMINI_API_KEY in .env")

        self._clients = [genai.Client(api_key=k) for k in keys]
        self._model_name = settings.gemini_model
        self._client_cycle = itertools.cycle(self._clients)
        logger.info("GeminiProvider initialized with %d API key(s), model=%s", len(keys), self._model_name)

    def _next_client(self):
        return next(self._client_cycle)

    async def _generate_with_rotation(self, contents):
        """Try each key in rotation until one succeeds or all are exhausted."""
        last_exc: Exception | None = None
        for _ in range(len(self._clients)):
            client = self._next_client()
            try:
                return await client.aio.models.generate_content(model=self._model_name, contents=contents)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning("Gemini key failed, trying next in rotation: %s", exc)
        raise last_exc  # type: ignore[misc]

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        prompt = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}\n\n{user}"
        try:
            resp = await self._generate_with_rotation(prompt)
            return json.loads(_strip_fences(resp.text))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_json failed on all keys, returning empty: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        prompt = f"{system}\n\n{user}"
        try:
            resp = await self._generate_with_rotation(prompt)
            return resp.text or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini complete_text failed on all keys: %s", exc)
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

        self._clients = [genai.Client(api_key=k) for k in keys]
        self._model_name = settings.gemini_model
        self._client_cycle = itertools.cycle(self._clients)
        logger.info("GeminiVisionProvider initialized with %d API key(s)", len(keys))

    def _next_client(self):
        return next(self._client_cycle)

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

        # Detect MIME type from bytes
        mime_type = "image/jpeg"
        if image_bytes[:4] == b"\x89PNG":
            mime_type = "image/png"
        elif image_bytes[:4] == b"RIFF":
            mime_type = "image/webp"

        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        # Enhanced prompt for reliable JSON output
        full_prompt = (
            f"{prompt}\n\n"
            "IMPORTANT: Return ONLY valid JSON, no markdown fences, no extra text."
        )

        last_exc: Exception | None = None
        for _ in range(len(self._clients)):
            client = self._next_client()
            try:
                resp = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=self._model_name,
                        contents=[full_prompt, image_part],
                    ),
                    timeout=_VISION_TIMEOUT_SECONDS,
                )
                data = json.loads(_strip_fences(resp.text))
                data.setdefault("degraded", False)
                data.setdefault("dish", "unknown dish")
                data.setdefault("ingredients", [])
                return data
            except asyncio.TimeoutError as exc:
                last_exc = exc
                logger.warning(
                    "Gemini vision call timed out after %ds, trying next key",
                    _VISION_TIMEOUT_SECONDS,
                )
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning("Gemini vision key failed, trying next in rotation: %s", exc)

        logger.warning("Gemini vision failed on all keys, degrading: %s", last_exc)
        return {"dish": None, "ingredients": [], "degraded": True}


def _strip_fences(text: str) -> str:
    """Gemini often wraps JSON in ```json fences — strip them before parsing."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t
        t = t.rsplit("```", 1)[0]
    return t.strip()
