# Mission Critical

Offline-first task management app with optional server sync and ntfy-based reminders.

This repository contains:
- `ixian-mission-critical`: SvelteKit + Capacitor frontend (web + mobile shells)
- `ixian-mission-critical-backend`: FastAPI + PostgreSQL backend
- `docker-compose.yml`: local stack for frontend, backend, Postgres, and ntfy

## Highlights

- Offline-first UX with Dexie (IndexedDB) as the primary local store
- Automatic background sync to backend when API URL is configured
- Soft-delete and conflict-tolerant sync model (last-write-wins via timestamps)
- Tag system with defaults + user-created tags
- Recurring tasks (`daily`, `weekly`, `monthly`, with alternating option)
- Optional push reminder pipeline via ntfy
- Capacitor support for iOS/Android plus web deployment

## Repo Layout

```text
.
├── docker-compose.yml
├── ixian-mission-critical/           # Frontend app (SvelteKit + Capacitor)
│   ├── src/lib/db/                   # Dexie schema, task/tag CRUD, sync engine
│   ├── src/lib/api/                  # Typed API client + endpoint modules
│   ├── src/lib/native/               # Notifications, haptics, platform bridges
│   └── src/routes/                   # App pages (+ setup flow)
└── ixian-mission-critical-backend/   # FastAPI app
    ├── app/api/v1/routes/            # REST routes (tasks, tags, hello)
    ├── app/models/                   # SQLAlchemy models
    ├── app/services/                 # Task/tag/notification services
    ├── alembic/                      # Migrations
    └── tests/                        # Pytest suite
```

## Architecture Overview

### Frontend

- Local data model lives in IndexedDB (`Dexie`), including sync metadata.
- UI reads reactive queries (`liveQuery`) and writes locally first.
- Mutations are marked `pending` and synced in the background.
- App setup flow lets users run in:
  - offline-only mode (no API URL), or
  - sync mode (API URL configured)
- Sync engine:
  - pulls server changes since last sync
  - pushes local pending tasks/tags
  - purges locally deleted items after successful server sync

### Backend

- FastAPI app serving `/api/v1/*` endpoints.
- Async SQLAlchemy + PostgreSQL persistence.
- Soft-delete model for tasks and tags.
- Background APScheduler job checks every minute for tasks due in ~15 minutes.
- Reminder notifications are published to ntfy when configured.

## API Surface (Current)

Base prefix: `/api/v1`

- Tasks
  - `GET /tasks` (optional `since`, `limit` ≤ 1000; soft-deleted included when `since` is set)
  - `GET /tasks/{task_id}`
  - `POST /tasks` (optional client `id` + timestamps for LWW sync)
  - `PATCH /tasks/{task_id}`
  - `DELETE /tasks/{task_id}` (soft delete)
  - `DELETE /tasks/{task_id}/hard` (hard delete; LAN maintenance only, omitted from OpenAPI)
- Tags
  - `GET /tags` (optional `since`, `limit` ≤ 1000)
  - `GET /tags/{tag_id}`
  - `POST /tags` (optional client `id`; `is_default` is server-controlled)
  - `PATCH /tags/{tag_id}`
  - `DELETE /tags/{tag_id}` (soft delete, default tags protected)

The client syncs via pull (`?since=`) + per-item create/update/delete. Shared UUIDs and client timestamps enable last-write-wins conflict resolution.

Additional:
- `GET /health` (app health)
- `GET /` (basic API info)
- FastAPI docs at `/docs` and `/redoc` (development only)

## Prerequisites

For Docker flow:
- Docker + Docker Compose

For local (non-Docker) flow:
- Node.js 22+
- `pnpm`
- Python 3.13+
- `uv` (recommended for backend dependency/runtime management)
- PostgreSQL 16+

## Quick Start (Docker Compose)

From repo root:

```bash
docker compose up --build
```

On low-memory hosts, set the Node build heap size:

```bash
NODE_MEMORY_MB=2048 docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Postgres: `localhost:5433`
- ntfy: `http://localhost:8082`

When opening the frontend from another device on your LAN, use the Docker host's
LAN IP, for example `http://192.168.1.10:3000`. In the app setup screen, enter
that same frontend URL as the Server URL. The frontend container proxies
`/api/v1` to the backend container, and the app adds `/api/v1` automatically.

Stop stack:

```bash
docker compose down
```

Reset DB volume:

```bash
docker compose down -v
```

## Local Development (Without Docker)

### 1) Backend

```bash
cd ixian-mission-critical-backend
cp .env.example .env
```

Set DB settings in `.env`, then run:

```bash
uv sync
uv run python -m alembic upgrade head
uv run python -m fastapi run app/main.py --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd ixian-mission-critical
cp .env.example .env
pnpm install
pnpm dev
```

Frontend defaults to Vite dev server (`http://localhost:5173`).

## Environment Configuration

### Root (`docker-compose.yml`)

Common compose vars:
- `POSTGRES_USER` (default: `postgres`)
- `POSTGRES_PASSWORD` — change this for any shared host; Compose still defaults to `postgres` for local convenience. Postgres is bound to `127.0.0.1:5433` only.
- `POSTGRES_DB` (default: `app`)
- `ENVIRONMENT` (default: `development`; OpenAPI `/docs` only when `development`)
- `DEBUG` (default: `false` in Compose)
- `BACKEND_CORS_ORIGINS` (comma-separated; set in backend `.env`)
- `BACKEND_CORS_ORIGIN_REGEX` (optional; Compose defaults so `192.168.*.*` LAN frontends can call API on `:8000` — set empty to disable)
- `NTFY_URL` / `NTFY_TOPIC` / optional `NTFY_TOKEN` — set in backend `.env`; topic must match the random topic shown in app setup/settings
- `NODE_MEMORY_MB` (default: `2048`; frontend build heap size in MB)

Android cleartext HTTP remains enabled for LAN sync (homelab). App backup is disabled (`allowBackup=false`).

### Backend (`ixian-mission-critical-backend/.env`)

See `.env.example` for full keys. Important ones:
- API metadata: `API_V1_PREFIX`, `PROJECT_NAME`, `VERSION`, `DESCRIPTION`
- Runtime: `ENVIRONMENT`, `DEBUG`
- CORS: `BACKEND_CORS_ORIGINS`, optional `BACKEND_CORS_ORIGIN_REGEX` for LAN IPs
- DB: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- ntfy: `NTFY_URL`, optional `NTFY_TOKEN`, `NTFY_TOPIC` (copy from the app’s setup/settings screen)

### Frontend (`ixian-mission-critical/.env`)

Optional local overrides only; Server URL and ntfy settings are stored per device during setup.

The frontend stores the Server URL per browser/device during setup. For Docker
Compose on a LAN, prefer the frontend origin such as `http://192.168.1.10:3000`;
nginx will proxy `/api/v1` to the backend. If you instead point clients directly
at the backend (`http://192.168.1.10:8000`), include the frontend LAN origin in
`BACKEND_CORS_ORIGINS`.

## Running Tests

### Backend

```bash
cd ixian-mission-critical-backend
uv run pytest
```

### Frontend

```bash
cd ixian-mission-critical
pnpm test
```

Type/lint checks:

```bash
pnpm check
pnpm lint
```

## Frontend Build and Mobile Targets

Build web app:

```bash
cd ixian-mission-critical
pnpm build
pnpm preview
```

Capacitor helpers:

```bash
pnpm sync
pnpm open:android
pnpm open:ios
```

## Notes on Sync and Data Behavior

- Local-first writes mean UI is responsive even when offline.
- Pending changes are retried when connectivity returns.
- Deletions are soft by default and purged locally once synced.
- Server/client conflict handling is timestamp-based (`updated_at`).
- Tasks and tags use millisecond Unix timestamps to match JS `Date.now()`.

## Troubleshooting

- Setup keeps redirecting to `/setup`:
  - complete setup once, or set `VITE_SKIP_SETUP=true` in frontend `.env` for local dev.
- Frontend can’t reach backend:
  - from the Docker host, verify backend health at `http://localhost:8000/health`
  - from another LAN device, configure Server URL as the frontend URL, e.g. `http://192.168.1.10:3000`
  - **Capacitor (iOS/Android):** the Server URL is stored on each device (not synced from your desktop browser). Use your LAN URL (not `localhost`). Rebuild the native app after pulling changes that affect Android `network_security_config` / iOS ATS, then run **Test connection** in Settings.
  - if calling the backend directly from the browser, ensure CORS allows your frontend origin: add `http://<lan-ip>:3000` to `BACKEND_CORS_ORIGINS`, or use `BACKEND_CORS_ORIGIN_REGEX` (Compose sets a sensible default for `192.168.*.*`). If Firefox reports `Access-Control-Allow-Origin` missing while the JSON response loads, your `Origin` is not in `allow_origins` and doesn’t match the regex.
- ntfy reminders not firing:
  - ensure backend `NTFY_URL` is set and reachable
  - ensure tasks have `due_at`, are not completed/deleted, and are ~15 minutes out.
- Database migration issues:
  - confirm backend `.env` DB values match your running Postgres instance.

## License

This project is licensed under the **Mission Critical Non-Commercial Source License v1.0**.

- Free for personal, educational, and other non-commercial use
- Commercial use is not permitted without separate permission

See [LICENSE](./LICENSE) for full terms.
