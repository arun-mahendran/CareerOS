"""Admin platform analytics tests on an isolated SQLite database; never touch a deployed database."""
import os
from datetime import timedelta

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "admin-analytics-tests-only-not-a-production-secret"

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models import ActivityEvent, Application, Company, FollowedCompany, Job, JobSource, Notification, User
from app.models.user import Role
from app.routers.admin_analytics import router as analytics_router
from app.utils import utcnow

TABLES = ("users", "companies", "job_sources", "jobs", "resumes", "applications", "followed_companies", "notifications",
          "activity_events")


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
        now = utcnow()
        admin = User(email="admin@x.io", password_hash="x", role=Role.ADMIN)
        candidate = User(email="cand@x.io", password_hash="x")
        old_user = User(email="old@x.io", password_hash="x")
        db.add_all([admin, candidate, old_user])
        db.flush()
        old_user.created_at = now - timedelta(days=60)  # registered before the 30-day window
        co = Company(slug="acme", name="Acme")
        db.add(co)
        db.flush()
        src = JobSource(key="greenhouse-global-acme", name="Acme · Greenhouse", kind="ATS", provider="greenhouse",
                        board_token="acme", company_id=co.id, enabled=True, status="OK", validated_at=now,
                        last_success_at=now, last_fetched_count=5, last_new_count=2)
        db.add(src)
        db.flush()
        for i in (1, 2):
            db.add(Job(slug=f"job-{i}", company_id=co.id, source_id=src.id, external_id=str(i), title="Backend Developer",
                       location="Remote", work_mode="Remote", level="Mid", description="d",
                       official_url=f"https://x/{i}", apply_url=f"https://x/{i}/apply",
                       posted_at=now, first_seen_at=now - timedelta(days=i)))
        db.add(Job(slug="job-old", company_id=co.id, source_id=src.id, external_id="old", title="Data Analyst",
                   location="Chennai", work_mode="On-site", level="Entry", description="d",
                   official_url="https://x/old", apply_url="https://x/old/apply",
                   posted_at=now, first_seen_at=now - timedelta(days=40), status="EXPIRED"))
        db.add(Application(user_id=candidate.id, company_name="Acme", role_title="Backend Developer"))
        db.add(FollowedCompany(user_id=candidate.id, company_id=co.id))
        db.add(FollowedCompany(user_id=old_user.id, company_id=co.id))
        db.add(Notification(user_id=candidate.id, type="JOB_ALERT", title="New job"))
        db.add(ActivityEvent(user_id=candidate.id, kind="JOB_SEARCHED", ref_id="backend"))
        db.add(ActivityEvent(user_id=candidate.id, kind="JOB_SEARCHED", ref_id="backend"))
        db.add(ActivityEvent(user_id=old_user.id, kind="JOB_VIEWED", ref_id="job-1"))
        db.commit()

        app = FastAPI()
        app.include_router(analytics_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: db
        yield SimpleNamespace(db=db, admin=admin, candidate=candidate, app=app)
    engine.dispose()


def client_as(ctx, user):
    ctx.app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(ctx.app)


def test_candidate_cannot_access_any_analytics_endpoint(ctx):
    c = client_as(ctx, ctx.candidate)
    for path in ("overview", "users", "jobs", "engagement", "notifications", "insights"):
        assert c.get(f"/api/v1/admin/analytics/{path}").status_code == 403, path


def test_overview_counts_are_real(ctx):
    r = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/overview?days=30")
    assert r.status_code == 200
    d = r.json()
    assert d["users"]["total"] == 3
    assert d["users"]["new"] == 2  # old_user registered 60 days ago
    assert d["jobs"]["active"] == 2 and d["jobs"]["new"] == 2
    assert d["companies"] == {"total": 1, "with_sources": 1, "new": 1}
    assert d["applications"] == {"total": 1, "new": 1}
    assert d["engagement"]["events"] == 3
    assert d["active_users"]["monthly"] == 2
    assert d["users"]["growth_pct"] is None  # no previous-period base — never fabricated


def test_users_series_and_cumulative(ctx):
    d = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/users?days=30").json()
    assert d["range"]["bucket"] == "daily"
    assert sum(p["count"] for p in d["registrations"]) == 2
    assert d["cumulative"][-1]["count"] == 3  # base (1 old user) + 2 new
    assert sum(p["count"] for p in d["activity"]) == 3


def test_jobs_aggregations(ctx):
    d = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/jobs?days=30").json()
    assert sum(p["count"] for p in d["new_per_period"]) == 2  # expired job first seen 40 days ago is out of range
    assert d["by_company"] == [{"name": "Acme", "jobs": 2}]
    assert d["by_role"] == [{"name": "Backend Developer", "jobs": 2}]
    assert d["by_location"] == [{"name": "Remote", "jobs": 2}]
    src = d["sources"][0]
    assert src["jobs"] == 2 and src["last_fetched"] == 5 and src["status"] == "OK"


def test_engagement_uses_recorded_events_only(ctx):
    d = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/engagement?days=30").json()
    assert d["most_followed"] == [{"name": "Acme", "followers": 2}]
    assert d["searched_roles"] == [{"term": "backend", "count": 2}]
    kinds = {f["kind"]: f["events"] for f in d["feature_usage"]}
    assert kinds == {"JOB_SEARCHED": 2, "JOB_VIEWED": 1}
    assert d["activity"]["new_registrations"] == 2
    assert d["activity"]["returning_users"] == 1  # old_user active, registered before the window


def test_notifications_honest_email_state(ctx):
    d = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/notifications?days=30").json()
    assert d["total"] == 1 and d["read"] == 0
    assert d["by_type"] == [{"type": "JOB_ALERT", "count": 1}]
    assert d["email"]["configured"] is False  # no fake delivery/open rates


def test_insights_derived_from_data(ctx):
    d = client_as(ctx, ctx.admin).get("/api/v1/admin/analytics/insights?days=30").json()
    text = " ".join(i["text"] for i in d["insights"])
    assert "Acme is the most followed company (2 followers)" in text
    assert "Backend Developer" in text
    assert "Acme · Greenhouse" in text


def test_invalid_ranges_rejected(ctx):
    c = client_as(ctx, ctx.admin)
    assert c.get("/api/v1/admin/analytics/overview?days=0").status_code == 422
    assert c.get("/api/v1/admin/analytics/overview?days=400").status_code == 422
    assert c.get("/api/v1/admin/analytics/overview?start=2026-01-10").status_code == 422  # end missing
    assert c.get("/api/v1/admin/analytics/overview?start=2026-02-01&end=2026-01-01").status_code == 422


def test_custom_range_and_monthly_bucket(ctx):
    c = client_as(ctx, ctx.admin)
    r = c.get("/api/v1/admin/analytics/users?start=2025-01-01&end=2025-12-31")
    assert r.status_code == 200
    assert r.json()["range"]["bucket"] == "monthly"
