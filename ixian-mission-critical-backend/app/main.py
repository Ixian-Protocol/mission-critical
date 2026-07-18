"""
Main FastAPI application.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.error_handlers import (
    app_exception_handler,
    general_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.exceptions import AppException
from app.middleware.logging_middleware import LoggingMiddleware
from app.scheduler import start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    if settings.NTFY_URL:
        logger.info("Starting scheduler with ntfy notifications to %s", settings.NTFY_URL)
        start_scheduler()
    else:
        logger.info("NTFY_URL not configured, task reminders disabled")

    yield

    # Shutdown
    stop_scheduler()


def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application instance
    """
    is_dev = settings.ENVIRONMENT.lower() == "development"

    # Initialize FastAPI app
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url="/openapi.json" if is_dev else None,
        lifespan=lifespan,
    )

    # Configure CORS — credentials off (no cookie auth); narrow methods/headers
    cors_kwargs: dict = {
        "allow_origins": settings.BACKEND_CORS_ORIGINS,
        "allow_credentials": False,
        "allow_methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
    }
    if settings.BACKEND_CORS_ORIGIN_REGEX:
        cors_kwargs["allow_origin_regex"] = settings.BACKEND_CORS_ORIGIN_REGEX
    app.add_middleware(CORSMiddleware, **cors_kwargs)

    # Add custom middleware
    app.add_middleware(LoggingMiddleware)

    # Register exception handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

    # Include routers
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Root endpoint
    @app.get(
        "/",
        tags=["Root"],
        summary="Root endpoint",
        description="Returns basic API information",
    )
    async def root():
        """Root endpoint with API information."""
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "description": settings.DESCRIPTION,
            "docs": "/docs" if is_dev else None,
            "redoc": "/redoc" if is_dev else None,
        }

    # Health check endpoint
    @app.get(
        "/health",
        tags=["Health"],
        summary="Application health check",
        description="Check if the application is running",
    )
    async def health_check():
        """Application-level health check."""
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
        }

    logger.info("Application '%s' initialized successfully", settings.PROJECT_NAME)

    return app


# Create the application instance
app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )
