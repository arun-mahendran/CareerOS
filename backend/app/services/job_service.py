from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from datetime import timedelta

from app.core.config import get_settings
from app.models import Company, Experience, Job, JobSkill, JobSource, SavedJob, Skill
from app.services.skill_service import classify, user_levels
from app.utils import utcnow

SORTS = {"newest": Job.posted_at.desc(), "oldest": Job.posted_at.asc(), "title": Job.title.asc(),
         "discovered": Job.first_seen_at.desc()}


def _aware(d):
    from datetime import timezone
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def is_new(job: Job) -> bool:
    """NEW = first discovered by CareerOS within the window. Re-seen jobs keep their original discovery time."""
    fs = _aware(job.first_seen_at)
    return bool(fs and not job.source.is_demo and utcnow() - fs <= timedelta(hours=get_settings().NEW_JOB_WINDOW_HOURS))


def job_out(job: Job, saved: bool = False) -> dict:
    return {
        "id": job.id, "slug": job.slug, "title": job.title, "company_id": job.company_id,
        "company": job.company.name, "location": job.location, "work_mode": job.work_mode, "level": job.level,
        "salary": job.salary, "description": job.description,
        "requirements": [r for r in (job.requirements or "").split("\n") if r.strip()],
        "skills": [{"name": s.skill.name, "required_level": s.required_level, "importance": s.importance} for s in job.skills],
        "posted_at": job.posted_at, "updated_at": job.source_updated_at,
        "freshness_days": max(0, (utcnow() - _aware(job.posted_at)).days),
        "employment_type": job.employment_type, "department": job.department, "first_seen_at": job.first_seen_at,
        "posted_at_known": job.posted_at_known, "is_new": is_new(job),
        "source": {"key": job.source.key, "name": job.source.name, "kind": job.source.kind, "is_demo": job.source.is_demo},
        "official_url": job.official_url, "apply_url": job.apply_url, "status": job.status, "saved": saved,
    }


def _base():
    stmt = (select(Job).join(Job.company).join(Job.source)
            .where(Job.status == "ACTIVE", JobSource.enabled.is_(True), JobSource.is_demo.is_(False)))
    return (stmt
            .options(selectinload(Job.company), selectinload(Job.source),
                     selectinload(Job.skills).selectinload(JobSkill.skill)))


def saved_ids(db: Session, user_id: str) -> set[str]:
    return set(db.scalars(select(SavedJob.job_id).where(SavedJob.user_id == user_id)).all())


def page_meta(db: Session) -> dict:
    real = select(JobSource).where(JobSource.is_demo.is_(False), JobSource.provider.is_not(None))
    srcs = db.scalars(real).all()
    window = get_settings().NEW_JOB_WINDOW_HOURS
    new_jobs = db.scalar(select(func.count()).select_from(Job).join(Job.source).where(
        Job.status == "ACTIVE", JobSource.is_demo.is_(False), JobSource.enabled.is_(True),
        Job.first_seen_at >= utcnow() - timedelta(hours=window))) or 0
    last = max((s.last_success_at for s in srcs if s.last_success_at), default=None)
    return {"last_successful_sync": last, "configured_sources": len(srcs),
            "healthy_sources": sum(1 for s in srcs if s.enabled and s.status == "OK" and s.validated_at),
            "new_jobs": new_jobs, "new_window_hours": window, "includes_demo": False}


def list_jobs(db: Session, user_id: str, q: str | None, mode: str | None, level: str | None,
              location: str | None, company_id: str | None, sort: str, page: int, page_size: int,
              employment_type: str | None = None, skill: str | None = None, remote: bool | None = None,
              new_only: bool = False) -> dict:
    stmt = _base()
    if employment_type:
        stmt = stmt.where(Job.employment_type.ilike(f"%{employment_type}%"))
    if remote:
        stmt = stmt.where(Job.work_mode == "Remote")
    if skill:
        stmt = stmt.where(Job.id.in_(select(JobSkill.job_id).join(Skill, Skill.id == JobSkill.skill_id)
                                     .where(Skill.name.ilike(f"%{skill}%"))))
    if new_only:
        stmt = stmt.where(Job.first_seen_at >= utcnow() - timedelta(hours=get_settings().NEW_JOB_WINDOW_HOURS),
                          JobSource.is_demo.is_(False))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Company.name.ilike(like), Job.description.ilike(like)))
    if mode:
        stmt = stmt.where(Job.work_mode == mode)
    if level:
        stmt = stmt.where(Job.level == level)
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    if company_id:
        stmt = stmt.where(Job.company_id == company_id)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(SORTS.get(sort, SORTS["newest"]), Job.id).offset((page - 1) * page_size).limit(page_size)).all()
    ids = saved_ids(db, user_id)
    return {"items": [job_out(j, j.id in ids) for j in rows], "total": total, "page": page, "page_size": page_size,
            "meta": page_meta(db)}


def get_job(db: Session, job_id: str) -> Job:
    job = db.scalar(_base().where(or_(Job.id == job_id, Job.slug == job_id)))
    if not job:
        raise HTTPException(404, "Job not found")
    return job


def save(db: Session, user_id: str, job_id: str) -> None:
    job = get_job(db, job_id)
    if not db.scalar(select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job.id)):
        db.add(SavedJob(user_id=user_id, job_id=job.id))
        db.commit()


def unsave(db: Session, user_id: str, job_id: str) -> None:
    job = get_job(db, job_id)
    row = db.scalar(select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job.id))
    if row:
        db.delete(row)
        db.commit()


def saved(db: Session, user_id: str) -> list[dict]:
    ids = saved_ids(db, user_id)
    if not ids:
        return []
    return [job_out(j, True) for j in db.scalars(_base().where(Job.id.in_(ids))).all()]


def match(db: Session, user_id: str, job_id: str) -> dict:
    """Transparent, informational requirement alignment. No hiring/interview probability."""
    job = get_job(db, job_id)
    levels = user_levels(db, user_id)
    out = {"MATCHED": [], "PARTIAL": [], "MISSING": []}
    for js in job.skills:
        cur = levels.get(js.skill_id, 0)
        state = classify(cur, js.required_level)
        out["MATCHED" if state == "STRONG" else state].append(
            {"name": js.skill.name, "your_level": cur, "required_level": js.required_level, "importance": js.importance})
    years = sum(
        max(0, ((e.end_date or utcnow().date()) - e.start_date).days) / 365
        for e in db.scalars(select(Experience).where(Experience.user_id == user_id)).all() if e.start_date
    )
    required = [s for s in job.skills if s.importance == "REQUIRED"] or job.skills
    met = sum(1 for s in required if levels.get(s.skill_id, 0) >= s.required_level)
    return {"job_id": job.id, "matched": out["MATCHED"], "partial": out["PARTIAL"], "missing": out["MISSING"],
            "experience_requirement_met": years >= job.min_experience_years,
            "requirement_alignment": round(100 * met / len(required)) if required else 0}
