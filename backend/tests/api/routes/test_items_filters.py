from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import ItemCreate, ItemPriority, ItemStatus
from tests.utils.item import create_random_item
from tests.utils.utils import random_lower_string

ITEMS_URL = f"{settings.API_V1_STR}/items/"


def _normal_user_id(db: Session):
    user = crud.get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    return user.id


def _create(db: Session, owner_id, **fields):
    item_in = ItemCreate(title=fields.pop("title", random_lower_string()), **fields)
    return crud.create_item(session=db, item_in=item_in, owner_id=owner_id)


def test_create_item_with_new_fields(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "title": "Write report",
        "status": "in_progress",
        "priority": "high",
        "due_date": "2030-01-15",
    }
    r = client.post(ITEMS_URL, headers=superuser_token_headers, json=data)
    assert r.status_code == 200
    content = r.json()
    assert content["status"] == "in_progress"
    assert content["priority"] == "high"
    assert content["due_date"] == "2030-01-15"
    assert content["updated_at"] is not None


def test_defaults_when_fields_omitted(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(ITEMS_URL, headers=superuser_token_headers, json={"title": "x"})
    assert r.status_code == 200
    assert r.json()["status"] == "todo"
    assert r.json()["priority"] == "medium"


def test_invalid_enum_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        ITEMS_URL, headers=superuser_token_headers, json={"title": "x", "status": "nope"}
    )
    assert r.status_code == 422


def test_search_and_filters(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    owner_id = _normal_user_id(db)
    tag = random_lower_string()[:12]
    _create(db, owner_id, title=f"{tag} alpha", priority=ItemPriority.high)
    _create(db, owner_id, title=f"{tag} beta", status=ItemStatus.done)
    _create(db, owner_id, title="unrelated", description=f"mentions {tag}")

    r = client.get(ITEMS_URL, headers=normal_user_token_headers, params={"q": tag})
    assert r.json()["count"] == 3  # matches title or description

    r = client.get(
        ITEMS_URL,
        headers=normal_user_token_headers,
        params={"q": tag, "priority": "high"},
    )
    assert [i["title"] for i in r.json()["data"]] == [f"{tag} alpha"]

    r = client.get(
        ITEMS_URL, headers=normal_user_token_headers, params={"q": tag, "status": "done"}
    )
    assert [i["title"] for i in r.json()["data"]] == [f"{tag} beta"]


def test_search_never_returns_other_users_items(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    other = create_random_item(db)  # owned by a different random user
    r = client.get(
        ITEMS_URL, headers=normal_user_token_headers, params={"q": other.title}
    )
    assert r.json()["count"] == 0


def test_sort_by_priority_and_reject_unknown_sort(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    owner_id = _normal_user_id(db)
    tag = random_lower_string()[:12]
    for p in (ItemPriority.medium, ItemPriority.high, ItemPriority.low):
        _create(db, owner_id, title=f"{tag} {p.value}", priority=p)

    r = client.get(
        ITEMS_URL,
        headers=normal_user_token_headers,
        params={"q": tag, "sort": "-priority"},
    )
    assert [i["priority"] for i in r.json()["data"]] == ["high", "medium", "low"]

    r = client.get(
        ITEMS_URL, headers=normal_user_token_headers, params={"sort": "title; DROP"}
    )
    assert r.status_code == 422


def test_overdue_filter(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    owner_id = _normal_user_id(db)
    tag = random_lower_string()[:12]
    yesterday = date.today() - timedelta(days=1)
    _create(db, owner_id, title=f"{tag} late", due_date=yesterday)
    _create(db, owner_id, title=f"{tag} late but done", due_date=yesterday, status=ItemStatus.done)
    _create(db, owner_id, title=f"{tag} future", due_date=date.today() + timedelta(days=3))

    r = client.get(
        ITEMS_URL, headers=normal_user_token_headers, params={"q": tag, "overdue": True}
    )
    assert [i["title"] for i in r.json()["data"]] == [f"{tag} late"]


def test_pagination_limit_is_capped(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(ITEMS_URL, headers=normal_user_token_headers, params={"limit": 1000})
    assert r.status_code == 422


def test_update_bumps_updated_at(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    before = item.updated_at
    r = client.put(
        f"{ITEMS_URL}{item.id}",
        headers=superuser_token_headers,
        json={"status": "done"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "done"
    assert r.json()["title"] == item.title  # partial update kept the title
    assert r.json()["updated_at"] > before.isoformat().replace("+00:00", "Z")


def test_stats_only_count_own_items(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    before = client.get(f"{ITEMS_URL}stats", headers=normal_user_token_headers).json()

    owner_id = _normal_user_id(db)
    _create(db, owner_id, status=ItemStatus.done)
    _create(db, owner_id, due_date=date.today() - timedelta(days=2))
    create_random_item(db)  # someone else's item must not be counted

    after = client.get(f"{ITEMS_URL}stats", headers=normal_user_token_headers).json()
    assert after["total"] == before["total"] + 2
    assert after["overdue"] == before["overdue"] + 1
    by_status = {s["key"]: s["count"] for s in after["by_status"]}
    assert set(by_status) == {"todo", "in_progress", "done"}
    assert len(after["created_per_day"]) == 14
    assert after["created_per_day"][-1]["count"] >= 2  # created today
