"""Swappable LLM/Vision provider layer (Requirement 9.2).

The rest of the app depends only on the `LLMProvider` / `VisionProvider`
protocols and the factory. Concrete providers (Groq, Gemini, Mock) are
selected from settings, so the app runs with zero API keys via the mock path.
"""
from app.llm.base import LLMProvider, VisionProvider
from app.llm.factory import get_text_provider, get_vision_provider

__all__ = [
    "LLMProvider",
    "VisionProvider",
    "get_text_provider",
    "get_vision_provider",
]
