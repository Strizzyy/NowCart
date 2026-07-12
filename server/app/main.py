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

    # Auto-seed the configured backend so the API is usable immediately
    if settings.data_backend == "memory":
        from app.seed.catalog import load_catalog
        from app.seed.mock_data import create_mock_users, create_mock_orders
        from app.seed.stock_overrides import get_override_product_ids
        from app.repositories import get_repository, get_cache

        repo = get_repository()
        cache = get_cache()

        products = load_catalog()
        override_ids = get_override_product_ids([p.product_id for p in products])
        override_set = set(override_ids)
        for p in products:
            if p.product_id in override_set:
                p.in_stock = False
        await repo.bulk_upsert_products(products)
        for pid in override_ids:
            await cache.set_stock_override(pid, False)

        users = create_mock_users()
        for user in users:
            await repo.upsert_user(user)

        orders = create_mock_orders([p.product_id for p in products])
        for order in orders:
            await repo.upsert_order(order)

        logger.info("Auto-seeded %d products, %d users, %d orders", len(products), len(users), len(orders))

    elif settings.data_backend == "dynamodb":
        # Auto-seed DynamoDB if tables are empty (first boot)
        from app.seed.seed_dynamodb import seed_dynamodb
        from app.seed.stock_overrides import get_override_product_ids
        from app.repositories import get_repository, get_cache

        try:
            await seed_dynamodb(force=False)

            # Always re-seed orders on startup — cheap operation, ensures
            # mock orders reference correct product IDs after any catalog changes
            from app.seed.mock_data import create_mock_users, create_mock_orders
            repo = get_repository()
            cache = get_cache()
            products = await repo.list_products()
            if products:
                orders = create_mock_orders([p.product_id for p in products])
                for order in orders:
                    await repo.upsert_order(order)
                override_ids = get_override_product_ids([p.product_id for p in products])
                for pid in override_ids:
                    await cache.set_stock_override(pid, False)
                logger.info("DynamoDB ready: %d products, %d orders re-seeded, %d stock overrides",
                            len(products), len(orders), len(override_ids))
        except Exception as exc:
            logger.error("DynamoDB seed failed: %s — app will start but catalog may be empty", exc)

    # Pre-warm catalog cache so first user request is fast
    from app.services.catalog_service import get_catalog_service
    catalog = get_catalog_service()
    all_products = await catalog._get_all_products()
    logger.info("Catalog cache warmed: %d products in memory", len(all_products))

    # Build hybrid retrieval index (bi-encoder + cross-encoder + rapidfuzz)
    if settings.semantic_search_enabled:
        try:
            from app.services.semantic_search_service import get_semantic_search_service
            semantic = get_semantic_search_service()
            await semantic.build_index(all_products)
            mode = "neural (bi-encoder + cross-encoder)" if semantic.using_neural_models else "rapidfuzz fallback"
            logger.info("Hybrid retrieval index ready — mode: %s", mode)
        except Exception as exc:
            logger.warning("Hybrid retrieval index build failed (non-critical): %s", exc)
            # App continues — match_node falls back to catalog fuzzy_match_need

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

    # Feature middleware — order matters: outermost runs first.
    # RequestId → Telemetry → RateLimit → PII (innermost).
    from app.middleware import RequestIdMiddleware, TelemetryMiddleware, RateLimitMiddleware, PiiRedactionMiddleware

    app.add_middleware(PiiRedactionMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(TelemetryMiddleware)
    app.add_middleware(RequestIdMiddleware)

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
