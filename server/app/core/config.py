"""Application configuration loaded from environment / .env.

Type-safe settings via pydantic-settings. One source of truth for the whole app.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_env: str = "dev"
    confidence_threshold: float = 0.7
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- LLM ---
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    llm_text_provider: Literal["groq", "gemini", "mock"] = "mock"
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

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
