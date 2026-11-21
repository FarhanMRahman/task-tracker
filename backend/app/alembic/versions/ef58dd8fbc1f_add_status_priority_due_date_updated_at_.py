"""Add status, priority, due_date, updated_at to item

Revision ID: ef58dd8fbc1f
Revises: fe56fa70289e
Create Date: 2026-11-21 03:45:44.860208

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'ef58dd8fbc1f'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


item_status = sa.Enum("todo", "in_progress", "done", name="itemstatus")
item_priority = sa.Enum("low", "medium", "high", name="itempriority")


def upgrade():
    # Hand-edited after autogenerate:
    # 1. add_column does not create Postgres enum types, so create them first.
    # 2. NOT NULL columns need a server_default, or the ALTER fails on existing rows.
    # 3. Backfill updated_at from created_at for existing rows.
    bind = op.get_bind()
    item_status.create(bind, checkfirst=True)
    item_priority.create(bind, checkfirst=True)

    op.add_column(
        "item",
        sa.Column("status", item_status, nullable=False, server_default="todo"),
    )
    op.add_column(
        "item",
        sa.Column("priority", item_priority, nullable=False, server_default="medium"),
    )
    op.add_column("item", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column(
        "item",
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    )
    op.execute("UPDATE item SET updated_at = created_at WHERE updated_at IS NULL")
    op.create_index(
        "ix_item_owner_id_created_at", "item", ["owner_id", "created_at"], unique=False
    )


def downgrade():
    op.drop_index("ix_item_owner_id_created_at", table_name="item")
    op.drop_column("item", "updated_at")
    op.drop_column("item", "due_date")
    op.drop_column("item", "priority")
    op.drop_column("item", "status")
    # Autogenerate forgets these: drop the enum types too
    bind = op.get_bind()
    item_priority.drop(bind, checkfirst=True)
    item_status.drop(bind, checkfirst=True)
