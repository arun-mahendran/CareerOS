from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    kind: Mapped[str] = mapped_column(String(20))  # COMPANY | ROLE | TECHNICAL | HR
    title: Mapped[str] = mapped_column(String(200))
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"))
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id", ondelete="SET NULL"))
    role: Mapped[str | None] = mapped_column(String(160))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    questions = relationship("InterviewQuestion", cascade="all, delete-orphan", order_by="InterviewQuestion.position")


class InterviewQuestion(Base, TimestampMixin):
    __tablename__ = "interview_questions"
    id: Mapped[str] = uuid_pk()
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(40))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    feedback: Mapped[str | None] = mapped_column(Text)  # practice feedback only
    position: Mapped[int] = mapped_column(Integer, default=0)
