# Railway Deployment Notes

This codebase was exported from containers running on [Railway](https://railway.app). The sections below summarise how the three services are configured.

## Services Overview

| Service | Runtime | Port | Healthcheck | Dockerfile |
|---|---|---|---|---|
| **backend** | Node.js 20 (`node:20-slim`) | 3100 | `GET /health` | `backend/Dockerfile` |
| **frontend** | Node.js 20 (`node:20-slim`) | 3000 | — | `frontend/Dockerfile` |
| **engine** | Python 3.11 (`python:3.11-slim`) | 3200 | `GET /engine/health` | `engine/Dockerfile` |

All three Dockerfiles reference a `layer1-strategy-market/` workspace prefix in their `COPY` instructions (e.g. `COPY layer1-strategy-market/backend/ .`). This reflects the directory layout Railway saw at build time and will need to be adjusted if building locally.

## railway.toml Files

### backend/railway.toml

```toml
[build]
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
```

### engine/railway.toml

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/engine/health"
restartPolicyType = "ON_FAILURE"
```

The frontend service has no `railway.toml`; it likely relied on Railway's auto-detection or dashboard-level configuration.

## .railwayignore Files

- `backend/.railwayignore` — excludes `node_modules`, `dist`, image files.
- `engine/.railwayignore` — excludes `__pycache__`, `.pyc`, `cache.db`, `.env`.

## Build-Time Arguments (Frontend)

The frontend Dockerfile accepts two `ARG`/`ENV` pairs injected by Railway at build time:

- `NEXT_PUBLIC_API_BASE` — URL of the backend service.
- `NEXT_PUBLIC_ENGINE_BASE` — URL of the engine service.

These are baked into the Next.js static build. The source code in `frontend/lib/api.ts` contains hardcoded fallback URLs pointing to the original Railway production domains.

## Environment Variables (Backend)

The backend reads these at runtime:

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (default `3100`) |
| `DB_PATH` | Path to the SQLite database file |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PYTHON_ENGINE_URL` | Internal URL of the engine service |

On Railway, inter-service communication typically uses Railway's private networking or the public service URLs.

## Caveats

1. **Exported from deployed containers.** This repository was created by pulling source from a running Railway project. File permissions, symlinks, or ephemeral runtime artifacts may differ from the original development repo.

2. **Dockerfile COPY paths.** Each Dockerfile expects a `layer1-strategy-market/<service>/` source layout. For local Docker builds, either adjust the `COPY` paths or restructure the build context.

3. **Hardcoded production URLs.** `frontend/lib/api.ts` contains fallback URLs to the Railway production endpoints. Override with environment variables for any other environment.

4. **SQLite in production.** The backend uses SQLite with WAL mode. On Railway this works on a single-instance service with a persistent volume, but it does not support horizontal scaling.

5. **No frontend railway.toml.** The frontend service configuration (start command, environment, etc.) was likely set through the Railway dashboard rather than committed to the repo.

6. **Dev-mode backend CMD.** The backend Dockerfile runs `npx tsx src/index.ts` (TypeScript executed directly) rather than a compiled `node dist/index.js` production build.
