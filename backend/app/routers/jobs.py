from typing import Literal

from fastapi import APIRouter, Query, status

from app.routers import DB, CurrentUser
from app.schemas.job import JobMatchOut, JobOut, JobPage
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])

Sort = Literal["newest", "oldest", "title", "discovered"]


@router.get("", response_model=JobPage)
def list_jobs(user: CurrentUser, db: DB, q: str | None = None, mode: str | None = None, level: str | None = None,
              location: str | None = None, company_id: str | None = None, sort: Sort = "newest",
              employment_type: str | None = None, skill: str | None = None, remote: bool | None = None,
              new_only: bool = False,
              page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    """Listings from official employer sources. Legacy demo rows are always excluded."""
    if q and q.strip():
        from app.models import ActivityEvent
        db.add(ActivityEvent(user_id=user.id, kind="JOB_SEARCHED", ref_id=q.strip()[:120]))
        db.commit()
    return job_service.list_jobs(db, user.id, q, mode, level, location, company_id, sort, page, page_size,
                                 employment_type, skill, remote, new_only)


opportunities = APIRouter(prefix="/opportunities", tags=["Jobs"])
opportunities.add_api_route("", list_jobs, methods=["GET"], response_model=JobPage)


@router.get("/search", response_model=JobPage)
def search(user: CurrentUser, db: DB, q: str = Query(min_length=1), page: int = Query(1, ge=1),
           page_size: int = Query(20, ge=1, le=100)):
    return job_service.list_jobs(db, user.id, q, None, None, None, None, "newest", page, page_size)


@router.get("/saved", response_model=list[JobOut])
def saved(user: CurrentUser, db: DB):
    return job_service.saved(db, user.id)


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, user: CurrentUser, db: DB):
    from app.models import ActivityEvent

    job = job_service.get_job(db, job_id)
    db.add(ActivityEvent(user_id=user.id, kind="JOB_VIEWED", ref_id=job.id))
    db.commit()
    return job_service.job_out(job, job.id in job_service.saved_ids(db, user.id))


@router.get("/{job_id}/match", response_model=JobMatchOut)
def match(job_id: str, user: CurrentUser, db: DB):
    return job_service.match(db, user.id, job_id)


@router.post("/{job_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def save(job_id: str, user: CurrentUser, db: DB):
    job_service.save(db, user.id, job_id)


@router.delete("/{job_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave(job_id: str, user: CurrentUser, db: DB):
    job_service.unsave(db, user.id, job_id)
