"""Application configuration loaded from environment / .env.

Type-safe settings via pydantic-settings. One source of truth for the whole app.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of the process
# working directory (e.g. when launched via systemd from a different cwd).
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"
_DEFAULT_FEATURE_LOG_PATH = str(Path(__file__).parent.parent.parent / "logs" / "feature_usage.jsonl")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_env: str = "dev"
    confidence_threshold: float = 0.7
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- LLM ---
    groq_api_key: str = ""
    groq_api_keys: str = ""  # comma-separated list for round-robin rotation
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: str = ""
    gemini_api_keys: str = ""  # comma-separated list for round-robin rotation
    gemini_model: str = "gemini-2.0-flash"
    bedrock_model: str = "anthropic.claude-3-haiku-20240307-v1:0"
    llm_text_provider: Literal["groq", "gemini", "bedrock", "mock"] = "mock"
    llm_vision_provider: Literal["gemini", "mock"] = "mock"

    # --- Data backend ---
    data_backend: Literal["dynamodb", "memory"] = "memory"
    aws_region: str = "ap-south-1"
    dynamodb_endpoint: str = ""
    aws_access_key_id: str = "local"
    aws_secret_access_key: str = "local"

    # --- Cache ---
    redis_url: str = "redis://localhost:6379/0"
    cache_in_memory: bool = True

    # --- Semantic Search ---
    embedding_model: str = "all-MiniLM-L6-v2"  # 80MB, fastest sentence-transformer
    semantic_search_enabled: bool = True
    semantic_top_k: int = 20  # candidates from vector search before re-ranking

    # --- Predictive / Zero Door ---
    prediction_enabled: bool = True
    depletion_lookback_orders: int = 10  # how many past orders to analyze
    restock_confidence_threshold: float = 0.6  # min confidence to include in prediction

    # --- Feature usage timing ---
    feature_log_path: str = _DEFAULT_FEATURE_LOG_PATH

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def groq_api_key_list(self) -> list[str]:
        """Return list of Groq API keys for round-robin rotation.

        Prefers GROQ_API_KEYS (comma-separated) but falls back to single GROQ_API_KEY.
        """
        if self.groq_api_keys:
            return [k.strip() for k in self.groq_api_keys.split(",") if k.strip()]
        if self.groq_api_key:
            return [self.groq_api_key]
        return []

    @property
    def gemini_api_key_list(self) -> list[str]:
        """Return list of Gemini API keys for round-robin rotation.

        Prefers GEMINI_API_KEYS (comma-separated) but falls back to single GEMINI_API_KEY.
        """
        if self.gemini_api_keys:
            return [k.strip() for k in self.gemini_api_keys.split(",") if k.strip()]
        if self.gemini_api_key:
            return [self.gemini_api_key]
        return []


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
