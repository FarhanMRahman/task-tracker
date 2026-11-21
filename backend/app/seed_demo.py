"""Seed realistic demo data for local development and demos.

Run inside the backend container:
    docker compose exec backend python app/seed_demo.py

Safe to re-run: it replaces the demo items of the superuser and the demo user.
Never run against production.
"""

import logging
import random
from datetime import UTC, date, datetime, timedelta

from sqlmodel import Session, delete, select

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.models import Item, ItemPriority, ItemStatus, User, UserCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_USER_EMAIL = "alex@example.com"
DEMO_USER_PASSWORD = "demo-password-123"  # local demo only

TITLES = [
    ("Prepare Q4 roadmap review", "Collect inputs from product and engineering"),
    ("Fix login rate limiting", "Throttle repeated failed attempts per IP"),
    ("Migrate reports to Postgres views", None),
    ("Write onboarding guide", "First-week checklist for new engineers"),
    ("Audit API permissions", "Check every route enforces ownership"),
    ("Set up error monitoring", "Sentry DSN for staging and production"),
    ("Refactor items query builder", None),
    ("Design dashboard empty states", "Friendly copy when there is no data"),
    ("Add CSV export", "Export filtered items as CSV"),
    ("Review dependency updates", "Dependabot PRs from this week"),
    ("Plan database backup drill", "Restore last night's snapshot to staging"),
    ("Improve search relevance", "Consider Postgres full-text search"),
    ("Customer call: invoicing", None),
    ("Update privacy policy page", "Legal sent the new wording"),
    ("Load test the items API", "Target p95 under 200 ms at 50 rps"),
    ("Clean up feature flags", None),
    ("Accessibility pass on forms", "Labels, focus order, contrast"),
    ("Document deployment steps", "Compose on a single EC2 host"),
    ("Investigate slow dashboard query", "Check the composite index is used"),
    ("Draft release notes", None),
]


def ensure_demo_user(session: Session) -> User:
    user = crud.get_user_by_email(session=session, email=DEMO_USER_EMAIL)
    if user:
        return user
    return crud.create_user(
        session=session,
        user_create=UserCreate(
            email=DEMO_USER_EMAIL, password=DEMO_USER_PASSWORD, full_name="Alex Morgan"
        ),
    )


def seed_items(session: Session, owner: User, count: int, rng: random.Random) -> None:
    session.exec(delete(Item).where(Item.owner_id == owner.id))  # type: ignore[call-overload]
    today = date.today()
    now = datetime.now(UTC)
    for i in range(count):
        title, description = TITLES[(i + rng.randint(0, 3)) % len(TITLES)]
        status = rng.choices(list(ItemStatus), weights=[5, 3, 4])[0]
        priority = rng.choices(list(ItemPriority), weights=[3, 5, 2])[0]
        # Mix of past (some overdue), upcoming and no due date
        due = rng.choice([None, *[today + timedelta(days=d) for d in (-6, -3, -1, 1, 2, 4, 6, 10, 20)]])
        created = now - timedelta(days=rng.randint(0, 13), hours=rng.randint(0, 23))
        session.add(
            Item(
                title=title,
                description=description,
                status=status,
                priority=priority,
                due_date=due,
                owner_id=owner.id,
                created_at=created,
                updated_at=created + timedelta(hours=rng.randint(0, 48)),
            )
        )
    session.commit()
    logger.info("Seeded %s items for %s", count, owner.email)


def main() -> None:
    rng = random.Random(42)  # deterministic: same demo data every run
    with Session(engine) as session:
        admin = session.exec(
            select(User).where(User.email == settings.FIRST_SUPERUSER)
        ).one()
        alex = ensure_demo_user(session)
        seed_items(session, admin, 18, rng)
        seed_items(session, alex, 14, rng)


if __name__ == "__main__":
    main()
