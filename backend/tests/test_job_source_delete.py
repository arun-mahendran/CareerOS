"""Admin job-source deletion tests on an isolated SQLite database; never touch a deployed database."""
import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "source-delete-tests-only-not-a-production-secret"

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models import Application, AuditLog, Company, Job, JobSource, User
from app.models.user import Role
from app.routers.admin import router as admin_router
from app.utils import utcnow

TABLES = ("users", "companies", "job_sources", "jobs", "job_skills", "skills", "resumes", "applications", "audit_logs")


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk_on(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine, tables=[Base.metadata.tables[n] for n in TABLES])  # test-only; real DBs use Alembic
    with Session(engine, expire_on_commit=False) as db:
        co = Company(slug="acme", name="Acme")
        admin = User(email="admin@x.io", password_hash="x", role=Role.ADMIN)
        candidate = User(email="cand@x.io", password_hash="x")
        db.add_all([co, admin, candidate])
        db.flush()
        src = JobSource(key="greenhouse-global-acme", name="Acme · Greenhouse", kind="ATS", provider="greenhouse",
                        board_token="acme", company_id=co.id, enabled=True, status="OK", validated_at=utcnow())
        db.add(src)
        db.flush()
        for i in (1, 2):
            db.add(Job(slug=f"job-{i}", company_id=co.id, source_id=src.id, external_id=str(i), title=f"Role {i}",
                       location="Remote", work_mode="Remote", level="Mid", description="d",
                       official_url=f"https://x/{i}", apply_url=f"https://x/{i}/apply", posted_at=utcnow()))
        db.flush()
        app_row = Application(user_id=candidate.id, job_id=db.scalar(select(Job.id).where(Job.slug == "job-1")),
                              company_name="Acme", role_title="Role 1")
        db.add(app_row)
        db.commit()

        app = FastAPI()
        app.include_router(admin_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: db
        state = SimpleNamespace(db=db, src=src, co=co, admin=admin, candidate=candidate, app=app, app_row=app_row)
        yield state
    engine.dispose()


def client_as(ctx, user):
    ctx.app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(ctx.app)


def test_admin_deletes_source_and_jobs_but_keeps_application(ctx):
    r = client_as(ctx, ctx.admin).delete(f"/api/v1/admin/job-sources/{ctx.src.id}")
    assert r.status_code == 200 and r.json() == {"deleted": True, "jobs_removed": 2}
    assert ctx.db.get(JobSource, ctx.src.id) is None
    assert ctx.db.scalar(select(func.count()).select_from(Job)) == 0
    ctx.db.refresh(ctx.app_row)
    assert ctx.app_row.job_id is None  # user data preserved, link cleared
    assert ctx.db.get(Company, ctx.co.id) is not None  # company untouched
    log = ctx.db.scalar(select(AuditLog).where(AuditLog.action == "SOURCE_DELETED"))
    assert log is not None and log.actor_id == ctx.admin.id and log.entity_id == ctx.src.id


def test_candidate_cannot_delete(ctx):
    r = client_as(ctx, ctx.candidate).delete(f"/api/v1/admin/job-sources/{ctx.src.id}")
    assert r.status_code == 403
    assert ctx.db.get(JobSource, ctx.src.id) is not None


def test_missing_source_404(ctx):
    r = client_as(ctx, ctx.admin).delete("/api/v1/admin/job-sources/does-not-exist")
    assert r.status_code == 404


def test_sync_in_progress_blocks_delete(ctx):
    ctx.src.sync_started_at = utcnow()
    ctx.db.commit()
    r = client_as(ctx, ctx.admin).delete(f"/api/v1/admin/job-sources/{ctx.src.id}")
    assert r.status_code == 409
    assert ctx.db.get(JobSource, ctx.src.id) is not None
