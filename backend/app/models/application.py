import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class AppStatus(str, enum.Enum):
    SAVED = "SAVED"
    APPLIED = "APPLIED"
    ASSESSMENT = "ASSESSMENT"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class Application(Base, TimestampMixin):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "job_id"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"), index=True)
    company_name: Mapped[str] = mapped_column(String(200))
    role_title: Mapped[str] = mapped_column(String(200))
    status: Mapped[AppStatus] = mapped_column(Enum(AppStatus, name="application_status"), default=AppStatus.SAVED, index=True)
    applied_on: Mapped[date | None] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date)
    resume_id: Mapped[str | None] = mapped_column(ForeignKey("resumes.id", ondelete="SET NULL"))
    url: Mapped[str | None] = mapped_column(String(400))
    history = relationship("ApplicationStatusHistory", cascade="all, delete-orphan", order_by="ApplicationStatusHistory.changed_at")
    notes = relationship("ApplicationNote", cascade="all, delete-orphan", order_by="ApplicationNote.created_at")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"
    id: Mapped[str] = uuid_pk()
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApplicationNote(Base, TimestampMixin):
    __tablename__ = "application_notes"
    id: Mapped[str] = uuid_pk()
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
