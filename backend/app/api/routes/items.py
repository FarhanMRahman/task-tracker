import uuid
from datetime import date, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import cast, nulls_last, or_
from sqlalchemy import Date as SADate
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    CountByKey,
    DailyCount,
    Item,
    ItemCreate,
    ItemPriority,
    ItemPublic,
    ItemsPublic,
    ItemsStats,
    ItemStatus,
    ItemUpdate,
    Message,
    get_datetime_utc,
)

router = APIRouter(prefix="/items", tags=["items"])

# Allow-list of sortable columns. Users pick a key; they never send SQL.
SORT_COLUMNS = {
    "created_at": Item.created_at,
    "updated_at": Item.updated_at,
    "due_date": Item.due_date,
    "priority": Item.priority,  # Postgres enums sort in declaration order
    "title": Item.title,
}
SortParam = Literal[
    "created_at",
    "-created_at",
    "updated_at",
    "-updated_at",
    "due_date",
    "-due_date",
    "priority",
    "-priority",
    "title",
    "-title",
]


def visible_items(statement: Any, current_user: CurrentUser) -> Any:
    """Superusers see every item; everyone else only sees their own."""
    if current_user.is_superuser:
        return statement
    return statement.where(Item.owner_id == current_user.id)


@router.get("/", response_model=ItemsPublic)
def read_items(
    session: SessionDep,
    current_user: CurrentUser,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: ItemStatus | None = None,
    priority: ItemPriority | None = None,
    overdue: bool = False,
    sort: SortParam = "-created_at",
) -> Any:
    """
    Retrieve items with search, filters, sorting and pagination.
    """
    filters = []
    if q:
        pattern = f"%{q}%"  # bound as a parameter, so this is not SQL injection
        filters.append(
            or_(col(Item.title).ilike(pattern), col(Item.description).ilike(pattern))
        )
    if status:
        filters.append(Item.status == status)
    if priority:
        filters.append(Item.priority == priority)
    if overdue:
        filters.append(col(Item.due_date) < date.today())
        filters.append(Item.status != ItemStatus.done)

    count_statement = visible_items(select(func.count()).select_from(Item), current_user)
    count = session.exec(count_statement.where(*filters)).one()

    column = SORT_COLUMNS[sort.lstrip("-")]
    order = col(column).desc() if sort.startswith("-") else col(column).asc()
    statement = (
        visible_items(select(Item), current_user)
        .where(*filters)
        .order_by(nulls_last(order), col(Item.id))  # id = stable tie-breaker
        .offset(skip)
        .limit(limit)
    )
    items = session.exec(statement).all()

    items_public = [ItemPublic.model_validate(item) for item in items]
    return ItemsPublic(data=items_public, count=count)


@router.get("/stats", response_model=ItemsStats)
def read_items_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Aggregates for the dashboard. All counting happens in Postgres (GROUP BY),
    not by loading rows into Python.
    """
    today = date.today()

    def scalar(*conditions: Any) -> int:
        statement = visible_items(select(func.count()).select_from(Item), current_user)
        return session.exec(statement.where(*conditions)).one()

    total = scalar()
    done = scalar(Item.status == ItemStatus.done)
    overdue = scalar(col(Item.due_date) < today, Item.status != ItemStatus.done)
    due_this_week = scalar(
        col(Item.due_date) >= today,
        col(Item.due_date) <= today + timedelta(days=7),
        Item.status != ItemStatus.done,
    )

    def grouped(column: Any) -> dict[str, int]:
        statement = visible_items(
            select(column, func.count()).select_from(Item), current_user
        ).group_by(column)
        return {str(key): n for key, n in session.exec(statement).all()}

    status_counts = grouped(Item.status)
    priority_counts = grouped(Item.priority)

    since = today - timedelta(days=13)
    day = cast(Item.created_at, SADate)
    daily_statement = (
        visible_items(select(day, func.count()).select_from(Item), current_user)
        .where(day >= since)
        .group_by(day)
    )
    daily = dict(session.exec(daily_statement).all())

    return ItemsStats(
        total=total,
        overdue=overdue,
        due_this_week=due_this_week,
        completion_rate=round(done / total, 3) if total else 0.0,
        # Fill in zero counts so the frontend always gets every key and every day
        by_status=[
            CountByKey(key=s.value, count=status_counts.get(s.value, 0))
            for s in ItemStatus
        ],
        by_priority=[
            CountByKey(key=p.value, count=priority_counts.get(p.value, 0))
            for p in ItemPriority
        ],
        created_per_day=[
            DailyCount(day=since + timedelta(days=i), count=daily.get(since + timedelta(days=i), 0))
            for i in range(14)
        ],
    )


@router.get("/{id}", response_model=ItemPublic)
def read_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get item by ID.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return item


@router.post("/", response_model=ItemPublic)
def create_item(
    *, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate
) -> Any:
    """
    Create new item.
    """
    item = Item.model_validate(item_in, update={"owner_id": current_user.id})
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.put("/{id}", response_model=ItemPublic)
def update_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    item_in: ItemUpdate,
) -> Any:
    """
    Update an item.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    update_dict = item_in.model_dump(exclude_unset=True)
    item.sqlmodel_update(update_dict, update={"updated_at": get_datetime_utc()})
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{id}")
def delete_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an item.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(item)
    session.commit()
    return Message(message="Item deleted successfully")
