from fastapi import APIRouter, status
from sqlalchemy import select

from app.models import Interview
from app.routers import DB, CurrentUser
from app.schemas.interview import FeedbackOut, GenerateQuestionsIn, InterviewIn, InterviewOut, MockAnswerIn, QuestionOut
from app.services import get_owned, interview_service

router = APIRouter(prefix="/interviews", tags=["Interviews"])


@router.get("", response_model=list[InterviewOut])
def list_interviews(user: CurrentUser, db: DB):
    return db.scalars(select(Interview).where(Interview.user_id == user.id).order_by(Interview.created_at.desc())).all()


@router.post("", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def create(body: InterviewIn, user: CurrentUser, db: DB):
    iv = Interview(user_id=user.id, **body.model_dump())
    db.add(iv)
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="INTERVIEW_STARTED", ref_id=iv.id))
    db.commit()
    db.refresh(iv)
    return iv


@router.get("/{interview_id}", response_model=InterviewOut)
def get(interview_id: str, user: CurrentUser, db: DB):
    return get_owned(db, Interview, interview_id, user.id)


@router.post("/{interview_id}/questions", response_model=InterviewOut)
def questions(interview_id: str, user: CurrentUser, db: DB, body: GenerateQuestionsIn | None = None, ai: bool = True):
    return interview_service.add_questions(db, user.id, interview_id, (body or GenerateQuestionsIn()).count, ai)


@router.post("/{interview_id}/mock", response_model=QuestionOut)
def mock(interview_id: str, body: MockAnswerIn, user: CurrentUser, db: DB):
    """Save a practice answer (no feedback yet)."""
    return interview_service.answer(db, user.id, interview_id, body.question_id, body.answer, with_feedback=False)


@router.post("/{interview_id}/feedback", response_model=FeedbackOut)
def feedback(interview_id: str, body: MockAnswerIn, user: CurrentUser, db: DB):
    q = interview_service.answer(db, user.id, interview_id, body.question_id, body.answer, with_feedback=True)
    return {"question_id": q.id, "feedback": q.feedback or ""}
