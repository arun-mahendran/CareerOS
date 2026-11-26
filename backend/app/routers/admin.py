from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.models import Application, AuditLog, Company, Job, JobSource, User
from app.routers import DB, AdminUser
from app.schemas.company import CompanyIn
from app.schemas.job import JobAdminUpdate, SourceAdminOut, SourceCreate, SourceUpdate, SyncResultOut

router = APIRouter(prefix="/admin", tags=["Admin"])


def audit(db, actor: User, action: str, entity: str, entity_id: str | None, detail: str | None = None):
    db.add(AuditLog(actor_id=actor.id, action=action, entity=entity, entity_id=entity_id, detail=detail))


def _n(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


@router.get("/dashboard")
def dashboard(admin: AdminUser, db: DB):
    return {"users": _n(db, User), "companies": _n(db, Company), "jobs": _n(db, Job),
            "applications": _n(db, Application), "sources": _n(db, JobSource),
            "sources_in_error": db.scalar(select(func.count()).where(JobSource.status == "ERROR")) or 0}


@router.get("/users")
def users(admin: AdminUser, db: DB, limit: int = 100, offset: int = 0):
    rows = db.scalars(select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)).all()
    return [{"id": u.id, "email": u.email, "role": u.role.value, "is_active": u.is_active, "created_at": u.created_at,
             "name": u.profile.full_name if u.profile else None,
             "target_role": u.profile.target_role if u.profile else None} for u in rows]


@router.put("/users/{user_id}/active")
def set_active(user_id: str, active: bool, admin: AdminUser, db: DB):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id:
        raise HTTPException(400, "You cannot disable your own account")
    u.is_active = active
    audit(db, admin, "USER_ACTIVE_SET", "user", u.id, str(active))
    db.commit()
    return {"id": u.id, "is_active": u.is_active}


@router.get("/companies")
def companies(admin: AdminUser, db: DB):
    return db.scalars(select(Company).order_by(Company.name)).all()


@router.post("/companies", status_code=201)
def create_company(body: CompanyIn, admin: AdminUser, db: DB):
    c = Company(**body.model_dump())
    db.add(c)
    db.flush()
    audit(db, admin, "COMPANY_CREATED", "company", c.id, c.name)
    db.commit()
    return c


@router.get("/jobs")
def jobs(admin: AdminUser, db: DB, limit: int = 100, offset: int = 0):
    rows = db.scalars(select(Job).order_by(Job.posted_at.desc()).limit(limit).offset(offset)).all()
    return [{"id": j.id, "title": j.title, "company": j.company.name, "status": j.status, "source": j.source.name,
             "posted_at": j.posted_at, "location": j.location, "official_url": j.official_url, "apply_url": j.apply_url} for j in rows]


@router.put("/jobs/{job_id}")
def update_job(job_id: str, body: JobAdminUpdate, admin: AdminUser, db: DB):
    j = db.get(Job, job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(j, k, v)
    audit(db, admin, "JOB_UPDATED", "job", j.id, body.model_dump_json(exclude_unset=True))
    db.commit()
    return {"id": j.id, "status": j.status, "title": j.title}


def _source_out(db, s: JobSource) -> dict:
    from datetime import timedelta
    from app.utils import utcnow
    started = s.sync_started_at
    if started is not None and started.tzinfo is None:
        from datetime import timezone
        started = started.replace(tzinfo=timezone.utc)
    jobs_n = db.scalar(select(func.count()).select_from(Job).where(Job.source_id == s.id, Job.status == "ACTIVE")) or 0
    return {**{c: getattr(s, c) for c in SourceAdminOut.model_fields if hasattr(s, c)},
            "company_name": s.company.name if s.company else None,
            "monitored": bool(s.validated_at and s.enabled and s.status == "OK"),
            "syncing": bool(started and utcnow() - started < timedelta(minutes=15)), "job_count": jobs_n}


def _get_source(db, source_id: str) -> JobSource:
    s = db.get(JobSource, source_id)
    if not s:
        raise HTTPException(404, "Source not found")
    return s


@router.get("/sources", response_model=list[SourceAdminOut])
@router.get("/job-sources", response_model=list[SourceAdminOut])
def sources(admin: AdminUser, db: DB):
    return [_source_out(db, s) for s in db.scalars(select(JobSource).order_by(JobSource.name)).all()]


@router.post("/job-sources", response_model=SourceAdminOut, status_code=201)
def create_source(body: SourceCreate, admin: AdminUser, db: DB):
    """Register a company board. It stays unverified until a test or sync succeeds against the real API."""
    import re
    from app.services.job_providers import PROVIDERS
    token = body.board_token.strip()
    if db.scalar(select(JobSource).where(JobSource.provider == body.provider, JobSource.board_token == token,
                                         JobSource.region == body.region)):
        raise HTTPException(409, "This board is already registered")
    company = db.get(Company, body.company_id) if body.company_id else None
    if body.company_id and not company:
        raise HTTPException(404, "Company not found")
    if not company:
        if not body.company_name:
            raise HTTPException(422, "Choose an existing company or enter the company name")
        slug = re.sub(r"[^a-z0-9]+", "-", body.company_name.lower()).strip("-")[:110] or token.lower()
        company = db.scalar(select(Company).where(Company.slug == slug))
        if not company:
            company = Company(slug=slug, name=body.company_name.strip(),
                              careers_url=str(body.careers_url) if body.careers_url else None)
            db.add(company)
            db.flush()
    p = PROVIDERS[body.provider]
    s = JobSource(key=f"{body.provider}-{body.region}-{token}".lower()[:80], name=f"{company.name} · {p.label}",
                  kind="ATS", is_demo=False, enabled=body.enabled, status="UNVERIFIED", provider=body.provider,
                  board_token=token, region=body.region, company_id=company.id,
                  careers_url=str(body.careers_url) if body.careers_url else company.careers_url)
    db.add(s)
    db.flush()
    audit(db, admin, "SOURCE_CREATED", "job_source", s.id, s.key)
    db.commit()
    return _source_out(db, s)


@router.put("/sources/{source_id}", response_model=SourceAdminOut)
@router.put("/job-sources/{source_id}", response_model=SourceAdminOut)
def update_source(source_id: str, body: SourceUpdate, admin: AdminUser, db: DB):
    s = _get_source(db, source_id)
    data = body.model_dump(exclude_unset=True)
    if s.is_demo and set(data) - {"enabled"}:
        raise HTTPException(400, "Demo source configuration cannot be edited")
    for k, v in data.items():
        if v is None and k != "enabled":
            continue
        setattr(s, k, str(v) if k == "careers_url" else v)
    if {"board_token", "region"} & set(data):
        s.validated_at, s.status, s.last_error = None, "UNVERIFIED", None  # re-validate a changed board
    audit(db, admin, "SOURCE_UPDATED", "job_source", s.id, body.model_dump_json(exclude_unset=True))
    db.commit()
    return _source_out(db, s)


@router.post("/job-sources/{source_id}/test", response_model=SyncResultOut)
def test_source(source_id: str, admin: AdminUser, db: DB):
    """Fetch and parse the live board without storing jobs."""
    from app.services.job_sources import test_source as run_test
    from app.utils import utcnow
    s = _get_source(db, source_id)
    if s.is_demo:
        raise HTTPException(400, "Demo source has no live board to test")
    r = run_test(s)
    s.last_checked_at = utcnow()
    if r.ok:
        s.validated_at = s.validated_at or utcnow()
        if s.status in ("UNVERIFIED", "IDLE"):
            s.status = "IDLE"
    else:
        s.last_error = f"{r.error_kind}: {r.error}"[:500]
        if not s.validated_at:
            s.status = "ERROR"
    audit(db, admin, "SOURCE_TESTED", "job_source", s.id, "ok" if r.ok else r.error_kind)
    db.commit()
    return r.as_dict()


@router.post("/sources/{source_id}/sync", response_model=SyncResultOut)
@router.post("/job-sources/{source_id}/sync", response_model=SyncResultOut)
def sync_source(source_id: str, admin: AdminUser, db: DB):
    from app.services.job_sources import run_sync
    s = _get_source(db, source_id)
    r = run_sync(db, s)
    audit(db, admin, "SOURCE_SYNC", "job_source", s.id, "ok" if r.ok else (r.error_kind or "error"))
    db.commit()
    if r.skipped:
        raise HTTPException(409, r.error or "A sync is already running")
    return r.as_dict()


@router.post("/job-sources/sync-all")
def sync_all_sources(admin: AdminUser, db: DB):
    from app.services.job_sources import sync_all
    results = sync_all(db)
    audit(db, admin, "SOURCE_SYNC_ALL", "job_source", None, f"{len(results)} sources")
    db.commit()
    return results


@router.delete("/job-sources/{source_id}")
def delete_source(source_id: str, admin: AdminUser, db: DB):
    """Remove a source and its listings. Applications, resumes and skill ratings that
    referenced those jobs keep their rows — their job link is cleared (SET NULL)."""
    from datetime import timedelta, timezone
    from app.utils import utcnow
    s = _get_source(db, source_id)
    started = s.sync_started_at
    if started is not None:
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        if utcnow() - started < timedelta(minutes=15):
            raise HTTPException(409, "A sync is running for this source — try again when it finishes")
    jobs = db.scalars(select(Job).where(Job.source_id == s.id)).all()
    for j in jobs:
        db.delete(j)  # job_skills cascade; applications/resumes/skill ratings SET NULL at the DB
    key, sid = s.key, s.id
    db.delete(s)
    audit(db, admin, "SOURCE_DELETED", "job_source", sid, f"{key} · {len(jobs)} jobs removed")
    db.commit()
    return {"deleted": True, "jobs_removed": len(jobs)}


@router.get("/audit-logs")
def audit_logs(admin: AdminUser, db: DB, limit: int = 200):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [{"id": a.id, "actor_id": a.actor_id, "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
             "detail": a.detail, "created_at": a.created_at} for a in rows]
