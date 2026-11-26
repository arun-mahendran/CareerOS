from fastapi import APIRouter, Response, status
from sqlalchemy import select

from app.models import Resume
from app.routers import DB, CurrentUser
from app.schemas.resume import AnalyzeOut, ResumeIn, ResumeOut, ResumeUpdate, SuggestionsOut, TailorIn
from app.services import ai_service, get_owned, resume_service

router = APIRouter(prefix="/resumes", tags=["Resumes"])


@router.get("", response_model=list[ResumeOut])
def list_resumes(user: CurrentUser, db: DB):
    rows = db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.updated_at.desc())).all()
    return [resume_service.out(r) for r in rows]


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
def create(body: ResumeIn, user: CurrentUser, db: DB):
    resume = resume_service.create(db, user.id, body)
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="RESUME_CREATED", ref_id=resume.id))
    db.commit()
    return resume_service.out(resume)


@router.get("/{resume_id}", response_model=ResumeOut)
def get(resume_id: str, user: CurrentUser, db: DB):
    return resume_service.out(get_owned(db, Resume, resume_id, user.id))


@router.put("/{resume_id}", response_model=ResumeOut)
def update(resume_id: str, body: ResumeUpdate, user: CurrentUser, db: DB):
    return resume_service.out(resume_service.update(db, user.id, resume_id, body))


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(resume_id: str, user: CurrentUser, db: DB):
    db.delete(get_owned(db, Resume, resume_id, user.id))
    db.commit()


@router.post("/{resume_id}/tailor", response_model=SuggestionsOut)
def tailor(resume_id: str, body: TailorIn, user: CurrentUser, db: DB):
    """Returns editable suggestions. Nothing is saved until the user PUTs an edited version."""
    r = get_owned(db, Resume, resume_id, user.id)
    v = resume_service.latest(r)
    s = ai_service.resume_suggestions(resume_service.candidate_facts(db, user.id), v.sections if v else [],
                                      resume_service.job_brief(db, body.job_id))
    return {"suggestions": s}


@router.post("/{resume_id}/analyze", response_model=AnalyzeOut)
def analyze(resume_id: str, user: CurrentUser, db: DB, job_id: str | None = None):
    return resume_service.analyze(db, user.id, resume_id, job_id)


def _name(db, user) -> str:
    return user.profile.full_name if user.profile else user.email


@router.post("/{resume_id}/export/pdf")
def export_pdf(resume_id: str, user: CurrentUser, db: DB):
    r = get_owned(db, Resume, resume_id, user.id)
    return Response(resume_service.export_pdf(r, _name(db, user)), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{r.title}.pdf"'})


@router.post("/{resume_id}/export/docx")
def export_docx(resume_id: str, user: CurrentUser, db: DB):
    r = get_owned(db, Resume, resume_id, user.id)
    return Response(resume_service.export_docx(r, _name(db, user)),
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="{r.title}.docx"'})
