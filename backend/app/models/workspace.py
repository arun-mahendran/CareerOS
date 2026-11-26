"""Per-user workspace records used directly by the CareerOS screens.

Shapes mirror what the frontend reads and writes (resume builder, application organizer, roadmap,
skill ratings, learning hub, interview practice). Every row belongs to one user; the API decides the owner
from the session, never from the request body.
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models._base import user_fk, uuid_pk


def _ts() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ResumeDocument(Base):
    __tablename__ = "resume_documents"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    title: Mapped[str] = mapped_column(String(200), default="Untitled resume", nullable=False)
    target_role: Mapped[str | None] = mapped_column(String(160))
    template: Mapped[str] = mapped_column(String(40), default="ats", nullable=False)
    target_job_id: Mapped[str | None] = mapped_column(String(120))
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class TrackedApplication(Base):
    __tablename__ = "tracked_applications"
    __table_args__ = (UniqueConstraint("user_id", "job_id", name="uq_tracked_app_user_job"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    job_id: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="saved", nullable=False)
    company: Mapped[str | None] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    job_type: Mapped[str | None] = mapped_column(String(60))
    job_url: Mapped[str | None] = mapped_column(String(1000))
    career_url: Mapped[str | None] = mapped_column(String(1000))
    salary: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    applied_on: Mapped[date | None] = mapped_column(Date)
    follow_up_on: Mapped[date | None] = mapped_column(Date)
    follow_up_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_note: Mapped[str | None] = mapped_column(Text)
    interview_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resume_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("resume_documents.id", ondelete="SET NULL"))
    history: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class RoadmapProgress(Base):
    __tablename__ = "roadmap_progress"
    __table_args__ = (CheckConstraint("status in ('in_progress','completed','skipped')", name="ck_roadmap_progress_status"),)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    step_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    minutes_logged: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class RoadmapPreference(Base):
    __tablename__ = "roadmap_preferences"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    weekly_hours: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    pace: Mapped[str] = mapped_column(String(20), default="steady", nullable=False)
    skill_level: Mapped[str] = mapped_column(String(20), default="beginner", nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date)
    priority_skills: Mapped[list[str]] = mapped_column(ARRAY(String(80)), default=list, nullable=False)
    updated_at: Mapped[datetime] = _ts()


class RoadmapStudyLog(Base):
    __tablename__ = "roadmap_study_logs"
    __table_args__ = (CheckConstraint("minutes between 1 and 1440", name="ck_study_minutes"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    step_id: Mapped[str] = mapped_column(String(120), nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    logged_on: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    created_at: Mapped[datetime] = _ts()


class SkillRating(Base):
    __tablename__ = "skill_ratings"
    __table_args__ = (CheckConstraint("level between 0 and 4", name="ck_skill_rating_level"),)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill: Mapped[str] = mapped_column(String(80), primary_key=True)
    level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="self", nullable=False)
    updated_at: Mapped[datetime] = _ts()


class LearningProgress(Base):
    __tablename__ = "learning_resource_progress"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    resource_url: Mapped[str] = mapped_column(String(500), primary_key=True)
    saved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="not_started", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = _ts()


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    interview_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_role: Mapped[str | None] = mapped_column(String(160))
    company: Mapped[str | None] = mapped_column(String(160))
    job_id: Mapped[str | None] = mapped_column(String(120))
    difficulty: Mapped[str] = mapped_column(String(20), default="Intermediate", nullable=False)
    practice_mode: Mapped[str] = mapped_column(String(10), default="guided", nullable=False)
    questions: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    feedback: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="in_progress", nullable=False)
    current_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class PasswordResetToken(Base):
    """Single-use reset tokens; only a SHA-256 hash is stored."""
    __tablename__ = "password_reset_tokens"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _ts()


class OAuthLoginCode(Base):
    """One-time code handed to the browser after Google sign-in, exchanged for tokens within 2 minutes."""
    __tablename__ = "oauth_login_codes"
    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = user_fk()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
