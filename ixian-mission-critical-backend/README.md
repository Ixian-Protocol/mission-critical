# Mission Critical (Backend)

FastAPI + PostgreSQL API for Mission Critical task/tag sync and ntfy reminders.

See the [root README](../README.md) for full product docs and Docker Compose usage.

## Local run

```bash
cp .env.example .env
# Edit POSTGRES_* and NTFY_TOPIC (match app setup/settings)
uv sync
uv run python -m alembic upgrade head
uv run python -m fastapi run app.main:app --host 0.0.0.0 --port 8000
```

## Tests / lint

```bash
uv run pytest
uv run ruff check .
```

OpenAPI docs (`/docs`) are enabled only when `ENVIRONMENT=development`.
