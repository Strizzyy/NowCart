"""Provider factory — selects implementations from settings (Requirement 9.2).

Falls back to the mock provider if a real provider can't be constructed
(e.g. missing key/SDK), so the app always boots and the demo never hard-fails.
"""
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider, VisionProvider
from app.llm.mock_provider import MockProvider, MockVisionProvider

logger = get_logger(__name__)


@lru_cache
def get_text_provider() -> LLMProvider:
    choice = settings.llm_text_provider
    try:
        if choice == "groq" and settings.groq_api_key:
            from app.llm.groq_provider import GroqProvider

            logger.info("Text provider: groq (%s)", settings.groq_model)
            return GroqProvider()
        if choice == "gemini" and settings.gemini_api_key:
            from app.llm.gemini_provider import GeminiProvider

            logger.info("Text provider: gemini (%s)", settings.gemini_model)
            return GeminiProvider()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falling back to mock text provider: %s", exc)

    if choice != "mock":
        logger.info("Text provider '%s' unavailable (no key?) — using mock", choice)
    return MockProvider()


@lru_cache
def get_vision_provider() -> VisionProvider:
    choice = settings.llm_vision_provider
    try:
        if choice == "gemini" and settings.gemini_api_key:
            from app.llm.gemini_provider import GeminiVisionProvider

            logger.info("Vision provider: gemini (%s)", settings.gemini_model)
            return GeminiVisionProvider()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falling back to mock vision provider: %s", exc)

    if choice != "mock":
        logger.info("Vision provider '%s' unavailable (no key?) — using mock", choice)
    return MockVisionProvider()
