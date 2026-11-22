# Task Tracker

A multi-user task tracker: people log in, manage tasks with status, priority and due dates, filter and search them, and see a live dashboard. Admins see everything and manage users.

Built on the official [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) (React + TypeScript, FastAPI, PostgreSQL, Docker Compose) and extended with Claude Code as a pair programmer: I set the design, reviewed every diff and fixed generated code where it was wrong.

**Design doc:** [docs/design.md](docs/design.md) (requirements, entities, API, architecture, data model, deep dives).

## What I added to the template

| Area | Change |
| --- | --- |
| Data model | `status` and `priority` (Postgres enums), `due_date`, `updated_at`, composite index on `(owner_id, created_at)` |
| Migration | Alembic autogenerate output fixed by hand: create enum types, server defaults for existing rows, backfill `updated_at`, drop enums on downgrade |
| Items API | Search (`q`), filters (`status`, `priority`, `overdue`), allow-listed `sort`, capped `limit`; one query builder with a single ownership helper |
| Stats API | `GET /api/v1/items/stats`: totals, completion rate, overdue, due this week, 14-day activity, breakdowns, all aggregated in SQL |
| Frontend | Dashboard with stat cards, activity chart and breakdowns; Items page with debounced search and filters kept in the URL; status, priority and due date in forms and table |
| Auth fix | A valid token for a deleted user returned 404 and the UI hung; it now returns 401 so the app logs the user out |
| Tests | 11 new backend tests (filters, sorting, permission isolation, stats, the 401 fix); 69 in total |
| Branding | Renamed to Task Tracker with a text + icon logo |

## Run it locally

```bash
# First edit .env: replace every "changethis" (SECRET_KEY, FIRST_SUPERUSER_PASSWORD, POSTGRES_PASSWORD)
docker compose up -d db backend mailpit proxy adminer
docker compose exec backend bash scripts/prestart.sh   # migrations + first admin user
docker compose exec backend python app/seed_demo.py    # demo users and 32 items
```

Open http://localhost:8000 (app), http://localhost:8000/docs (API), http://localhost:8080 (Adminer), http://localhost:8025 (Mailpit).

Demo logins: the admin from `FIRST_SUPERUSER` in `.env`, and `alex@example.com` / `demo-password-123` (a regular user who sees only their own items).

Run the backend tests with `docker compose exec backend bash scripts/tests-start.sh`. Note: the tests use the same database and clear it at the end, so run the prestart and seed commands again afterwards.

---

The original template README follows.

## Full Stack FastAPI Template

[![Test Docker Compose](../../actions/workflows/test-docker-compose.yml/badge.svg)](../../actions/workflows/test-docker-compose.yml)
[![Test Backend](../../actions/workflows/test-backend.yml/badge.svg)](../../actions/workflows/test-backend.yml)

## Technology Stack and Features

- ⚡ [**FastAPI**](https://fastapi.tiangolo.com) for the Python backend API.
  - 🧰 [SQLModel](https://sqlmodel.tiangolo.com) for the Python SQL database interactions (ORM).
  - 🔍 [Pydantic](https://docs.pydantic.dev), used by FastAPI, for the data validation and settings management.
  - 💾 [PostgreSQL](https://www.postgresql.org) as the SQL database.
- 🚀 [React](https://react.dev) for the frontend.
  - 🧩 Built into the backend application and served by FastAPI on the same domain as the API.
  - 💃 Using TypeScript, hooks, [Vite](https://vitejs.dev), and other parts of a modern frontend stack.
  - 🎨 [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) for the frontend components.
  - 🤖 An automatically generated frontend client.
  - 🧪 [Playwright](https://playwright.dev) for end-to-end testing.
  - 🦇 Dark mode support.
- ☁️ [FastAPI Cloud](https://fastapicloud.com) for deployment.
- 🐋 [Docker Compose](https://www.docker.com) for local services and self-hosted deployment.
  - 📞 [Traefik](https://traefik.io) as a reverse proxy with automatic HTTPS.
- 🔒 Secure password hashing by default.
- 🔑 JWT (JSON Web Token) authentication.
- 📫 Email-based password recovery.
- ✉️ [React Email](https://react.email) for email templates.
- 📬 [Mailpit](https://mailpit.axllent.org) for local email testing during development.
- ✅ Tests with [Pytest](https://pytest.org).
- 🏭 CI (continuous integration) and CD (continuous deployment) based on GitHub Actions.

### Dashboard Login

![Dashboard login screenshot](img/login.png)

### Dashboard - Admin

![Admin dashboard screenshot](img/dashboard.png)

### Dashboard - Items

![Items dashboard screenshot](img/dashboard-items.png)

### Dashboard - Dark Mode

![Dark mode dashboard screenshot](img/dashboard-dark.png)

### React Email Templates

![Email templates screenshot](img/react-email.png)

### Mailpit - Local Email Testing

![Mailpit screenshot](img/mailpit.png)

### Interactive API Documentation

![API docs](img/docs.png)

## How to Use It

Click the **Use this template** button at the top of this page to create a new repository.

## Backend Development

Backend docs: [backend/README.md](./backend/README.md).

## Frontend Development

Frontend docs: [frontend/README.md](./frontend/README.md).

## Deployment

FastAPI Cloud deployment: [deployment.md](./deployment.md).

Self-hosted deployment with Docker Compose: [deployment-docker-compose.md](./deployment-docker-compose.md).

## Development

General development docs: [development.md](./development.md).

This includes the local FastAPI and Vite workflow, Docker Compose services, `.env` configuration, and more.

## Release Notes

Check the file [release-notes.md](./release-notes.md).

## License

The Full Stack FastAPI Template is licensed under the terms of the MIT license.
