from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas import ORM


class InterviewIn(BaseModel):
    kind: Literal["COMPANY", "ROLE", "TECHNICAL", "HR"]
    title: str
    company_id: str | None = None
    application_id: str | None = None
    role: str | None = None
    scheduled_at: datetime | None = None


class QuestionOut(ORM):
    id: str
    category: str
    question: str
    answer: str | None
    feedback: str | None


class InterviewOut(ORM):
    id: str
    kind: str
    title: str
    company_id: str | None
    role: str | None
    scheduled_at: datetime | None
    questions: list[QuestionOut] = []


class GenerateQuestionsIn(BaseModel):
    count: int = 8


class MockAnswerIn(BaseModel):
    question_id: str
    answer: str


class FeedbackOut(BaseModel):
    question_id: str
    feedback: str
    note: str = "Practice feedback only — not a prediction of interview outcome."
