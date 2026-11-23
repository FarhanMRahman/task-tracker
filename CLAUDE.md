# Task Tracker: working agreement

## Workflow for every feature
- Start with a plan and ask clarifying questions before writing code.
- Follow the existing patterns: Items is the reference for models (`backend/app/models.py`), routes (`backend/app/api/routes/items.py`), frontend components (`frontend/src/components/Items/`), pages (`frontend/src/routes/_layout/items.tsx`) and tests (`backend/tests/api/routes/`).
- Work in small, focused steps, one commit per step.
- Before each commit: run the tests, type checks and linters, and add tests where applicable.
- After each step, STOP and show how to verify it: the test results, the files changed, and the UI or API steps to check by hand (URL, clicks, or a curl). Wait for an OK before the next step.

## Commands
Backend (run inside the container: `docker compose exec backend <cmd>`):
- Tests: `bash scripts/tests-start.sh`. The image doesn't include `tests/`, so first run `docker compose cp backend/tests backend:/app/backend/tests`. Tests use the dev database and wipe it, so afterwards run `bash scripts/prestart.sh` and `python app/seed_demo.py`.
- Types and lint: `mypy app`, `ruff check app`, `ruff format app --check`.
- Migrations: `alembic revision --autogenerate -m "..."`, then copy the file out with `docker compose cp`, review it by hand (enum types, server defaults, downgrade), and round-trip `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.

Frontend (from `frontend/`):
- Regenerate the API client after backend API changes: `curl -s localhost:8000/api/v1/openapi.json -o openapi.json && bun run generate-client`.
- Checks: `bunx tsc -p tsconfig.build.json --noEmit` and `bun run lint`.
- The frontend is built into the backend image: `docker compose up -d --build backend` to see UI changes at http://localhost:8000.

## Conventions
- Ownership is enforced server-side (see `visible_items`); never trust an owner id from a non-admin client.
- Money is `Decimal` / `NUMERIC(12,2)`, never float.
- In SQLModel queries, wrap model attributes in `col()` so comparisons type-check.
