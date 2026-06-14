"""Groq text provider (free-tier). JSON mode + retry, with safe degradation.

Uses Groq's fast inference API (Llama 3.3 70B) for:
- Recipe decomposition (outcome engine)
- URL/recipe content extraction (share service)
- Emergency kit generation (SOS service)
- Confidence scoring and substitution reasoning

Includes transparent LLM response caching: identical prompts within TTL
return cached results without hitting the Groq API (cost + latency savings).
Supports round-robin key rotation across multiple API keys to distribute
rate-limit load evenly.
"""
import hashlib
import itertools
import json

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Cache TTL for LLM responses (1 hour — same recipe = same decomposition)
_LLM_CACHE_TTL = 3600


def _cache_key(system: str, user: str) -> str:
    """Deterministic cache key from system + user prompts."""
    content = f"{system}||{user}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]


class GroqProvider:
    name = "groq"

    def __init__(self) -> None:
        from groq import AsyncGroq

        keys = settings.groq_api_key_list
        if not keys:
            raise ValueError("No Groq API keys configured. Set GROQ_API_KEYS or GROQ_API_KEY in .env")

        # Create a client per key and cycle through them round-robin
        self._clients = [AsyncGroq(api_key=k) for k in keys]
        self._client_cycle = itertools.cycle(self._clients)
        self._model = settings.groq_model
        logger.info("GroqProvider initialized with %d API key(s)", len(keys))

    def _next_client(self):
        """Get the next client in the round-robin rotation."""
        return next(self._client_cycle)

    async def _get_cache(self):
        """Lazy import to avoid circular deps at module load time."""
        from app.repositories import get_cache
        return get_cache()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, max=4), reraise=True)
    async def _chat(self, system: str, user: str, json_mode: bool, max_tokens: int = 2048) -> str:
        client = self._next_client()
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
        resp = await client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        """Return a parsed JSON object from Groq.

        Uses JSON mode for reliable structured output.
        Checks cache first — identical prompts return cached results.
        Falls back to {} on any failure to keep the pipeline running.
        """
        primed = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}"
        key = _cache_key(primed, user)

        # Check cache first
        try:
            cache = await self._get_cache()
            cached = await cache.get_cached_response(key)
            if cached is not None:
                logger.debug("LLM cache HIT for key=%s", key[:8])
                # Track cache hit in telemetry
                from app.middleware.telemetry import metrics as telemetry_metrics
                telemetry_metrics.cache_hits += 1
                return cached
        except Exception:
            pass  # Cache miss or error — proceed to LLM call

        # Track cache miss and LLM call in telemetry
        from app.middleware.telemetry import metrics as telemetry_metrics
        telemetry_metrics.cache_misses += 1
        telemetry_metrics.llm_calls += 1

        try:
            raw = await self._chat(primed, user, json_mode=True)
            result = json.loads(raw)

            # Store in cache for future identical prompts
            try:
                cache = await self._get_cache()
                await cache.set_cached_response(key, result, ttl=_LLM_CACHE_TTL)
                logger.debug("LLM cache SET for key=%s", key[:8])
            except Exception:
                pass  # Non-critical — caching failure doesn't break the pipeline

            return result
        except Exception as exc:  # noqa: BLE001 — degrade, never crash the pipeline
            logger.warning("Groq complete_json failed, returning empty: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        """Return a plain-text completion from Groq.

        Used for recipe extraction from URLs, text summarization, etc.
        Checks cache first for identical prompts.
        Falls back to empty string on failure.
        """
        key = _cache_key(system, user)

        # Check cache first
        try:
            cache = await self._get_cache()
            cached = await cache.get_cached_response(key)
            if cached is not None and isinstance(cached.get("text"), str):
                logger.debug("LLM text cache HIT for key=%s", key[:8])
                from app.middleware.telemetry import metrics as telemetry_metrics
                telemetry_metrics.cache_hits += 1
                return cached["text"]
        except Exception:
            pass

        # Track cache miss and LLM call
        from app.middleware.telemetry import metrics as telemetry_metrics
        telemetry_metrics.cache_misses += 1
        telemetry_metrics.llm_calls += 1

        try:
            result = await self._chat(system, user, json_mode=False)

            # Cache the text response
            try:
                cache = await self._get_cache()
                await cache.set_cached_response(key, {"text": result}, ttl=_LLM_CACHE_TTL)
            except Exception:
                pass

            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("Groq complete_text failed: %s", exc)
            return ""
