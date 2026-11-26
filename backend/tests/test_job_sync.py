"""Job aggregation tests on an isolated SQLite database; never touch a deployed database.

Set LIVE_BOARD_TESTS=1 to also call the real public Greenhouse/Lever/Ashby endpoints.
"""
import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "job-sync-tests-only-not-a-production-secret"

from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models import Company, FollowedCompany, Job, JobSource, Notification, User
from app.routers.jobs import router as jobs_router
from app.services import job_providers, job_sources
from app.services.job_providers import NormalizedJob, ProviderError
from app.utils import utcnow

GH = {"jobs": [
    {"id": 101, "title": "Backend Engineer ", "absolute_url": "https://boards.greenhouse.io/acme/jobs/101",
     "location": {"name": "Remote - India"}, "departments": [{"name": "Engineering"}],
     "content": "&lt;p&gt;Build APIs&lt;/p&gt;", "first_published": "2026-10-01T10:00:00-04:00",
     "updated_at": "2026-10-02T10:00:00-04:00"},
    {"id": 102, "title": "Designer", "absolute_url": "https://boards.greenhouse.io/acme/jobs/102",
     "location": {"name": "Bengaluru"}, "content": ""},
    {"title": "missing id is skipped"},
]}
LEVER = [{"id": "abc", "text": "Data Analyst", "hostedUrl": "https://jobs.lever.co/acme/abc",
          "applyUrl": "https://jobs.lever.co/acme/abc/apply", "categories": {"commitment": "Full-time",
          "location": "Pune", "team": "Data"}, "workplaceType": "hybrid", "descriptionPlain": "Analyse",
          "createdAt": 1790000000000}]
ASHBY = {"jobs": [{"id": "z1", "title": "SRE", "jobUrl": "https://jobs.ashbyhq.com/acme/z1",
                   "applyUrl": "https://jobs.ashbyhq.com/acme/z1/application", "employmentType": "FullTime",
                   "workplaceType": "Remote", "location": "Remote", "isListed": True,
                   "shouldDisplayCompensationOnJobPostings": True,
                   "compensation": {"compensationTierSummary": "$100K – $120K"},
                   "publishedAt": "2026-10-03T00:00:00Z", "descriptionPlain": "Keep it up"},
                  {"id": "z2", "title": "Hidden", "jobUrl": "https://x", "isListed": False}]}


def nj(ext, title="Role", **kw):
    return NormalizedJob(external_id=ext, title=title, description="d", official_url=f"https://x/{ext}",
                         apply_url=f"https://x/{ext}/apply", **kw)


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    names = ("users", "companies", "followed_companies", "job_sources", "jobs", "skills", "job_skills", "notifications",
             "saved_jobs", "activity_events")
    Base.metadata.create_all(engine, tables=[Base.metadata.tables[n] for n in names])  # test-only; real DBs use Alembic
    with Session(engine, expire_on_commit=False) as db:
        co = Company(slug="acme", name="Acme")
        db.add(co)
        db.flush()
        src = JobSource(key="greenhouse-global-acme", name="Acme · Greenhouse", kind="ATS", provider="greenhouse",
                        board_token="acme", company_id=co.id, enabled=True, status="UNVERIFIED")
        users = [User(email=f"u{i}@x.io", password_hash="x") for i in range(2)]
        db.add_all([src, *users])
        db.flush()
        db.add(FollowedCompany(user_id=users[0].id, company_id=co.id))
        db.commit()
        yield SimpleNamespace(db=db, src=src, co=co, users=users)
    engine.dispose()


def patch_fetch(monkeypatch, result):
    def fake(self, token, region="global", client=None):
        if isinstance(result, Exception):
            raise result
        return result() if callable(result) else result
    monkeypatch.setattr(job_providers.Greenhouse, "fetch", fake)


# ---- adapters
def test_greenhouse_parses_and_skips_invalid():
    jobs = job_providers.Greenhouse().parse(GH, "acme")
    assert [j.external_id for j in jobs] == ["101", "102"]
    j = jobs[0]
    assert j.title == "Backend Engineer" and j.description == "Build APIs" and j.department == "Engineering"
    assert j.work_mode == "Remote" and j.published_at is not None and j.apply_url.endswith("/101")
    assert jobs[1].work_mode is None and jobs[1].published_at is None  # nothing invented


def test_lever_and_ashby_parse():
    lv = job_providers.Lever().parse(LEVER, "acme")[0]
    assert (lv.employment_type, lv.work_mode, lv.department) == ("Full-time", "Hybrid", "Data")
    assert lv.apply_url.endswith("/apply")
    ab = job_providers.Ashby().parse(ASHBY, "acme")
    assert len(ab) == 1 and ab[0].salary == "$100K – $120K" and ab[0].employment_type == "Full-time"


def test_bad_shape_rejected():
    with pytest.raises(ProviderError) as e:
        job_providers.Greenhouse().parse({"oops": 1}, "acme")
    assert e.value.kind == "INVALID_RESPONSE"
    with pytest.raises(ProviderError):
        job_providers.Lever().fetch("../etc")


# ---- sync pipeline
def count(db, model, *where):
    return db.scalar(select(func.count()).select_from(model).where(*where))


def test_repeat_sync_no_duplicates_and_new_only_once(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1"), nj("2"), nj("2")])
    r1 = job_sources.run_sync(ctx.db, ctx.src)
    assert r1.ok and (r1.new, r1.fetched) == (2, 3)
    first_seen = {j.external_id: j.first_seen_at for j in ctx.db.scalars(select(Job)).all()}
    r2 = job_sources.run_sync(ctx.db, ctx.src)
    assert (r2.new, r2.updated, r2.unchanged) == (0, 0, 2)
    assert count(ctx.db, Job) == 2
    assert {j.external_id: j.first_seen_at for j in ctx.db.scalars(select(Job)).all()} == first_seen
    assert ctx.src.status == "OK" and ctx.src.validated_at is not None


def test_changed_job_counts_as_updated(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1")])
    job_sources.run_sync(ctx.db, ctx.src)
    patch_fetch(monkeypatch, [nj("1", title="Senior Role")])
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert (r.new, r.updated) == (0, 1)
    assert ctx.db.scalar(select(Job.title)) == "Senior Role"


def test_failure_keeps_existing_jobs(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1")])
    job_sources.run_sync(ctx.db, ctx.src)
    patch_fetch(monkeypatch, ProviderError("NETWORK", "down"))
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert not r.ok and r.error_kind == "NETWORK"
    assert ctx.src.status == "ERROR" and "NETWORK" in ctx.src.last_error
    assert count(ctx.db, Job, Job.status == "ACTIVE") == 1


def test_missing_job_expires_only_after_grace(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1"), nj("2")])
    job_sources.run_sync(ctx.db, ctx.src)
    patch_fetch(monkeypatch, [nj("1")])
    job_sources.run_sync(ctx.db, ctx.src)
    j2 = ctx.db.scalar(select(Job).where(Job.external_id == "2"))
    assert j2.status == "ACTIVE" and j2.missing_since is not None
    j2.missing_since = utcnow() - timedelta(hours=7)
    ctx.db.commit()
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert r.expired == 1 and j2.status == "EXPIRED"
    patch_fetch(monkeypatch, [nj("1"), nj("2")])  # reappears -> active again, not "new"
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert r.new == 0 and j2.status == "ACTIVE"


def test_followers_notified_once(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1")])
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert r.notifications == 1
    job_sources.run_sync(ctx.db, ctx.src)
    patch_fetch(monkeypatch, [nj("1", title="Changed")])
    job_sources.run_sync(ctx.db, ctx.src)
    assert count(ctx.db, Notification) == 1
    assert count(ctx.db, Notification, Notification.user_id == ctx.users[1].id) == 0


def test_overlapping_sync_is_skipped(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1")])
    assert job_sources.acquire_lock(ctx.db, ctx.src.id)
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert r.skipped and count(ctx.db, Job) == 0


def test_disabled_source_not_synced(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1")])
    ctx.src.enabled = False
    r = job_sources.run_sync(ctx.db, ctx.src)
    assert not r.ok and r.error_kind == "DISABLED" and count(ctx.db, Job) == 0


# ---- opportunities API
def test_api_filters_sort_pagination_and_demo_hidden(ctx, monkeypatch):
    patch_fetch(monkeypatch, [nj("1", "Backend Engineer", work_mode="Remote", employment_type="Full-time",
                                 location="Pune", published_at=utcnow() - timedelta(days=1)),
                              nj("2", "Designer", work_mode="Hybrid", employment_type="Contract", location="Delhi",
                                 published_at=utcnow())])
    job_sources.run_sync(ctx.db, ctx.src)
    demo = JobSource(key="demo", name="demo", kind="DEMO", is_demo=True, status="OK")
    ctx.db.add(demo)
    ctx.db.flush()
    ctx.db.add(Job(slug="demo-1", company_id=ctx.co.id, source_id=demo.id, external_id="d1", title="Demo role",
                   location="X", work_mode="Remote", level="Junior", description="", official_url="https://d",
                   apply_url="https://d", posted_at=utcnow(), first_seen_at=utcnow()))
    ctx.db.commit()
    app = FastAPI()
    app.include_router(jobs_router)
    app.dependency_overrides[get_db] = lambda: ctx.db
    app.dependency_overrides[get_current_user] = lambda: ctx.users[0]
    c = TestClient(app)
    body = c.get("/jobs").json()
    assert [i["title"] for i in body["items"]] == ["Designer", "Backend Engineer"]  # newest first, no demo
    assert body["meta"]["configured_sources"] == 1 and body["meta"]["healthy_sources"] == 1
    assert body["meta"]["new_jobs"] == 2 and all(i["is_new"] for i in body["items"])
    assert [i["title"] for i in c.get("/jobs", params={"remote": True}).json()["items"]] == ["Backend Engineer"]
    assert c.get("/jobs", params={"employment_type": "contract"}).json()["total"] == 1
    assert c.get("/jobs", params={"location": "pune"}).json()["total"] == 1
    assert c.get("/jobs", params={"q": "design"}).json()["total"] == 1
    p2 = c.get("/jobs", params={"page": 2, "page_size": 1}).json()
    assert p2["total"] == 2 and [i["title"] for i in p2["items"]] == ["Backend Engineer"]
    assert c.get("/jobs", params={"include_demo": True}).json()["total"] == 2  # legacy demo rows can never be requested


@pytest.mark.skipif(os.environ.get("LIVE_BOARD_TESTS") != "1", reason="set LIVE_BOARD_TESTS=1 for real API calls")
@pytest.mark.parametrize("provider,token", [("greenhouse", "airbnb"), ("lever", "palantir"), ("ashby", "ramp")])
def test_live_public_boards(provider, token):
    jobs = job_providers.PROVIDERS[provider].fetch(token)
    assert jobs and all(j.external_id and j.title and j.apply_url.startswith("https://") for j in jobs)
    with pytest.raises(ProviderError) as e:
        job_providers.PROVIDERS[provider].fetch("careeros-no-such-board-xyz")
    assert e.value.kind in ("NOT_FOUND", "HTTP")
