from fastapi import APIRouter, status

from app.routers import DB, CurrentUser
from app.schemas.company import CompanyOut
from app.schemas.job import JobPage
from app.services import company_service, job_service

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(user: CurrentUser, db: DB, q: str | None = None):
    return company_service.list_companies(db, user.id, q)


@router.get("/followed", response_model=list[CompanyOut])
def followed(user: CurrentUser, db: DB):
    return company_service.followed(db, user.id)


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, user: CurrentUser, db: DB):
    return company_service.get(db, user.id, company_id)


@router.get("/{company_id}/jobs", response_model=JobPage)
def company_jobs(company_id: str, user: CurrentUser, db: DB):
    c = company_service.get(db, user.id, company_id)
    return job_service.list_jobs(db, user.id, None, None, None, None, c["id"], "newest", 1, 100)


@router.post("/{company_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow(company_id: str, user: CurrentUser, db: DB):
    company_service.follow(db, user.id, company_id, True)


@router.delete("/{company_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow(company_id: str, user: CurrentUser, db: DB):
    company_service.follow(db, user.id, company_id, False)
