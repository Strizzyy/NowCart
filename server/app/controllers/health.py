"""Health controller — liveness probe (Requirement 9.x ops)."""
from fastapi import APIRouter

from app.models.dto.responses import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()
