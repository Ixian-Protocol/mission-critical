"""Health endpoint tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health(client: AsyncClient):
    """GET /health returns 200."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_api_v1_health_matches_root(client: AsyncClient):
    """GET /api/v1/health mirrors GET /health."""
    root = await client.get("/health")
    v1 = await client.get("/api/v1/health")
    assert v1.status_code == 200
    assert v1.json() == root.json()
