"""
Health routes under the v1 API prefix.

Mirrors GET /health so clients using /api/v1 as base URL can probe .../api/v1/health.
"""
from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Application health check (v1)",
    description="Same payload as GET /health; use when the API base URL includes /api/v1.",
)
async def health_check_v1():
    settings = get_settings()
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }
