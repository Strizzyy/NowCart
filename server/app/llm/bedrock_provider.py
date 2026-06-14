"""Amazon Bedrock provider — production LLM target (Requirement 9.2).

This provider wraps Amazon Bedrock's Converse API for text reasoning
(Claude 3 Haiku / Titan Text) and can be activated via:
    LLM_TEXT_PROVIDER=bedrock

Architecture: The identical LLMProvider interface means swapping from Groq
to Bedrock is a single environment variable change — no code modifications.

Bedrock advantages over Groq for production:
- Runs inside your AWS VPC (no data leaves your network)
- IAM-based auth (no API keys to rotate)
- AWS-managed scaling (no rate limit concerns at scale)
- SLA-backed availability

Note: Bedrock is NOT free tier. For the hackathon prototype we use Groq
(free, fast) and switch to Bedrock for production deployments.
"""
import hashlib
import json

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_LLM_CACHE_TTL = 3600


def _cache_key(system: str, user: str) -> str:
    content = f"{system}||{user}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]


class BedrockProvider:
    """Amazon Bedrock text provider via the Converse API.

    Uses boto3 bedrock-runtime client. Requires IAM role with
    bedrock:InvokeModel permission (on EC2, use instance profile).

    Supported models:
    - anthropic.claude-3-haiku-20240307-v1:0  (fast, cheap)
    - amazon.titan-text-express-v1            (AWS-native)
    - meta.llama3-70b-instruct-v1:0           (open-weight on Bedrock)
    """

    name = "bedrock"

    def __init__(self) -> None:
        import boto3

        self._client = boto3.client(
            "bedrock-runtime",
            region_name=settings.aws_region,
        )
        # Default to Claude 3 Haiku — fast and affordable
        self._model_id = getattr(settings, "bedrock_model", "anthropic.claude-3-haiku-20240307-v1:0")

    async def _get_cache(self):
        from app.repositories import get_cache
        return get_cache()

    def _invoke_sync(self, system: str, user: str, max_tokens: int = 2048) -> str:
        """Synchronous Bedrock Converse API call.

        Note: In production, wrap in asyncio.to_thread() for non-blocking.
        """
        response = self._client.converse(
            modelId=self._model_id,
            messages=[
                {"role": "user", "content": [{"text": f"{system}\n\n{user}"}]},
            ],
            inferenceConfig={
                "maxTokens": max_tokens,
                "temperature": 0.2,
            },
        )
        output = response["output"]["message"]["content"][0]["text"]
        return output

    async def _chat(self, system: str, user: str, max_tokens: int = 2048) -> str:
        """Async wrapper around the sync Bedrock call."""
        import asyncio
        return await asyncio.to_thread(self._invoke_sync, system, user, max_tokens)

    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict:
        """Return a parsed JSON object from Bedrock.

        Includes LLM response caching for cost optimization.
        """
        primed = f"{system}\n\nReturn ONLY valid JSON matching: {schema_hint}"
        key = _cache_key(primed, user)

        # Check cache
        try:
            cache = await self._get_cache()
            cached = await cache.get_cached_response(key)
            if cached is not None:
                logger.debug("Bedrock cache HIT for key=%s", key[:8])
                return cached
        except Exception:
            pass

        try:
            raw = await self._chat(primed, user)
            # Extract JSON from response (Bedrock may include extra text)
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(raw[start:end])
            else:
                result = json.loads(raw)

            # Cache result
            try:
                cache = await self._get_cache()
                await cache.set_cached_response(key, result, ttl=_LLM_CACHE_TTL)
            except Exception:
                pass

            return result
        except Exception as exc:
            logger.warning("Bedrock complete_json failed: %s", exc)
            return {}

    async def complete_text(self, system: str, user: str) -> str:
        """Return a plain-text completion from Bedrock."""
        key = _cache_key(system, user)

        try:
            cache = await self._get_cache()
            cached = await cache.get_cached_response(key)
            if cached is not None and isinstance(cached.get("text"), str):
                return cached["text"]
        except Exception:
            pass

        try:
            result = await self._chat(system, user)
            try:
                cache = await self._get_cache()
                await cache.set_cached_response(key, {"text": result}, ttl=_LLM_CACHE_TTL)
            except Exception:
                pass
            return result
        except Exception as exc:
            logger.warning("Bedrock complete_text failed: %s", exc)
            return ""
