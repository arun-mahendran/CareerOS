"""Calendar events: location and all-day flag.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("calendar_events") as t:
        t.add_column(sa.Column("location", sa.String(200)))
        t.add_column(sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("calendar_events") as t:
        t.drop_column("all_day")
        t.drop_column("location")
