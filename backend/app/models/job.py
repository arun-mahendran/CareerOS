from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class JobSource(Base, TimestampMixin):
    """A configured origin of job listings (official API, ATS feed, partner feed or permitted public source)."""

    __tablename__ = "job_sources"
    id: Mapped[str] = uuid_pk()
    key: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(40))  # DEMO | ATS | API | PARTNER | PUBLIC
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(40), default="IDLE")  # IDLE | OK | ERROR
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    # Real ATS board configuration (Greenhouse / Lever / Ashby). Null for legacy sources.
    provider: Mapped[str | None] = mapped_column(String(40))
    board_token: Mapped[str | None] = mapped_column(String(160))
    region: Mapped[str] = mapped_column(String(10), default="global", server_default="global")  # Lever: global | eu
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    careers_url: Mapped[str | None] = mapped_column(String(400))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # per-source overlap lock
    last_fetched_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_new_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_updated_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_expired_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    company = relationship("Company")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source_id", "external_id"),)
    id: Mapped[str] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("job_sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200), index=True)
    location: Mapped[str] = mapped_column(String(160))
    work_mode: Mapped[str] = mapped_column(String(20))  # Remote | Hybrid | On-site
    level: Mapped[str] = mapped_column(String(40))
    min_experience_years: Mapped[int] = mapped_column(Integer, default=0)
    salary: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text)  # newline-separated
    official_url: Mapped[str] = mapped_column(String(400))
    apply_url: Mapped[str] = mapped_column(String(400))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", index=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    employment_type: Mapped[str | None] = mapped_column(String(60))
    department: Mapped[str | None] = mapped_column(String(160))
    posted_at_known: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    missing_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    company = relationship("Company", back_populates="jobs")
    source = relationship("JobSource")
    skills = relationship("JobSkill", cascade="all, delete-orphan")


class JobSkill(Base):
    __tablename__ = "job_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id"),)
    id: Mapped[str] = uuid_pk()
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    required_level: Mapped[int] = mapped_column(Integer, default=70)
    importance: Mapped[str] = mapped_column(String(20), default="REQUIRED")  # REQUIRED | PREFERRED
    skill = relationship("Skill")


class SavedJob(Base, TimestampMixin):
    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("user_id", "job_id"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
