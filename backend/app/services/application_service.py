from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, ApplicationNote, ApplicationStatusHistory, Notification
from app.models.application import AppStatus
from app.services import get_owned
from app.services.job_service import get_job


def out(a: Application) -> dict:
    return {
        "id": a.id, "job_id": a.job_id, "company_name": a.company_name, "role_title": a.role_title,
        "status": a.status, "applied_on": a.applied_on, "deadline": a.deadline, "url": a.url,
        "created_at": a.created_at, "updated_at": a.updated_at,
        "notes": [{"id": n.id, "body": n.body, "created_at": n.created_at} for n in a.notes],
        "history": [{"from_status": h.from_status, "to_status": h.to_status, "changed_at": h.changed_at} for h in a.history],
    }


def create(db: Session, user_id: str, data) -> Application:
    company, role, url = data.company_name, data.role_title, data.url
    if data.job_id:
        job = get_job(db, data.job_id)
        if db.scalar(select(Application).where(Application.user_id == user_id, Application.job_id == job.id)):
            raise HTTPException(409, "You are already tracking this job")
        company, role, url = job.company.name, job.title, url or job.apply_url
    if not company or not role:
        raise HTTPException(422, "company_name and role_title are required when job_id is not given")
    a = Application(user_id=user_id, job_id=data.job_id and get_job(db, data.job_id).id, company_name=company,
                    role_title=role, status=data.status, applied_on=data.applied_on, deadline=data.deadline,
                    resume_id=data.resume_id, url=url)
    a.history.append(ApplicationStatusHistory(from_status=None, to_status=data.status.value))
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def set_status(db: Session, user_id: str, aid: str, status: AppStatus) -> Application:
    a = get_owned(db, Application, aid, user_id)
    if a.status != status:
        a.history.append(ApplicationStatusHistory(from_status=a.status.value, to_status=status.value))
        a.status = status
        db.add(Notification(user_id=user_id, type="APPLICATION", title=f"{a.company_name}: moved to {status.value.title()}",
                            link="/applications"))
        db.commit()
        db.refresh(a)
    return a


def add_note(db: Session, user_id: str, aid: str, body: str) -> Application:
    a = get_owned(db, Application, aid, user_id)
    a.notes.append(ApplicationNote(body=body))
    db.commit()
    db.refresh(a)
    return a
