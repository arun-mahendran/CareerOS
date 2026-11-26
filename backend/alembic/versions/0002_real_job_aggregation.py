"""Real job aggregation: ATS source configuration, discovery timestamps, notification de-duplication.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("job_sources") as t:
        t.add_column(sa.Column("provider", sa.String(40)))
        t.add_column(sa.Column("board_token", sa.String(160)))
        t.add_column(sa.Column("region", sa.String(10), nullable=False, server_default="global"))
        t.add_column(sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id", ondelete="SET NULL")))
        t.add_column(sa.Column("careers_url", sa.String(400)))
        t.add_column(sa.Column("validated_at", sa.DateTime(timezone=True)))
        t.add_column(sa.Column("sync_started_at", sa.DateTime(timezone=True)))
        for c in ("last_fetched_count", "last_new_count", "last_updated_count", "last_expired_count"):
            t.add_column(sa.Column(c, sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_job_sources_company_id", "job_sources", ["company_id"])
    op.create_index("uq_job_sources_provider_board", "job_sources", ["provider", "board_token", "region"], unique=True)

    with op.batch_alter_table("jobs") as t:
        t.add_column(sa.Column("employment_type", sa.String(60)))
        t.add_column(sa.Column("department", sa.String(160)))
        t.add_column(sa.Column("posted_at_known", sa.Boolean(), nullable=False, server_default=sa.true()))
        t.add_column(sa.Column("first_seen_at", sa.DateTime(timezone=True)))
        t.add_column(sa.Column("last_seen_at", sa.DateTime(timezone=True)))
        t.add_column(sa.Column("missing_since", sa.DateTime(timezone=True)))
        t.add_column(sa.Column("content_hash", sa.String(64)))
    op.create_index("ix_jobs_first_seen_at", "jobs", ["first_seen_at"])
    # Existing rows (demo seed) were discovered when created.
    op.execute("UPDATE jobs SET first_seen_at = created_at, last_seen_at = created_at WHERE first_seen_at IS NULL")

    with op.batch_alter_table("notifications") as t:
        t.add_column(sa.Column("dedupe_key", sa.String(200)))
        t.create_unique_constraint("uq_notifications_user_dedupe", ["user_id", "dedupe_key"])


def downgrade() -> None:
    with op.batch_alter_table("notifications") as t:
        t.drop_constraint("uq_notifications_user_dedupe", type_="unique")
        t.drop_column("dedupe_key")
    op.drop_index("ix_jobs_first_seen_at", "jobs")
    with op.batch_alter_table("jobs") as t:
        for c in ("employment_type", "department", "posted_at_known", "first_seen_at", "last_seen_at", "missing_since", "content_hash"):
            t.drop_column(c)
    op.drop_index("uq_job_sources_provider_board", "job_sources")
    op.drop_index("ix_job_sources_company_id", "job_sources")
    with op.batch_alter_table("job_sources") as t:
        for c in ("provider", "board_token", "region", "company_id", "careers_url", "validated_at", "sync_started_at",
                  "last_fetched_count", "last_new_count", "last_updated_count", "last_expired_count"):
            t.drop_column(c)
