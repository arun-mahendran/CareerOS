"""Remove legacy demo candidate and demo job-source records.

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Preserve applications/resumes that referenced a demo job: their job links become NULL.
    op.execute("""
        UPDATE tracked_applications
        SET company = COALESCE(company, 'Removed demo listing'),
            title = COALESCE(title, 'Removed demo listing')
        WHERE company IS NULL OR title IS NULL
    """)
    op.execute("DELETE FROM job_skills WHERE job_id IN (SELECT id FROM jobs WHERE source_id IN (SELECT id FROM job_sources WHERE is_demo = TRUE OR key = 'demo'))")
    op.execute("DELETE FROM jobs WHERE source_id IN (SELECT id FROM job_sources WHERE is_demo = TRUE OR key = 'demo')")
    op.execute("DELETE FROM job_sources WHERE is_demo = TRUE OR key = 'demo'")
    op.execute("DELETE FROM users WHERE email = 'candidate@careeros.dev'")


def downgrade() -> None:
    # Deleted demo records are intentionally not recreated.
    pass
