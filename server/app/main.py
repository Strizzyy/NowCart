"""NowCart FastAPI application entry.

Wires CORS, the aggregated API router, and a consistent error envelope.
The app boots and serves /health with zero API keys and the in-memory backend
(DATA_BACKEND=memory, LLM_*_PROVIDER=mock).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.controllers import api_router
from app.core.config import settings
from app.core.logging import get_logger
from app.models.dto.responses import ErrorResponse

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "NowCart starting | env=%s text=%s vision=%s data=%s",
        settings.app_env,
        settings.llm_text_provider,
        settings.llm_vision_provider,
        settings.data_backend,
    )
    yield
    logger.info("NowCart shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="NowCart",
        version="0.1.0",
        description="Intent-capture layer for quick-commerce.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Feature middleware (PII redaction, rate limit, request id) is added in
    # task 6.2 via app.add_middleware(...).

    app.include_router(api_router)

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(error="validation_error", detail=str(exc.errors())).model_dump(),
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="internal_error", detail=str(exc)).model_dump(),
        )

    return app


app = create_app()
