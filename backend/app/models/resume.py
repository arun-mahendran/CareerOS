from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    title: Mapped[str] = mapped_column(String(200))
    template: Mapped[str] = mapped_column(String(40), default="classic")
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    target_job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    versions = relationship("ResumeVersion", cascade="all, delete-orphan", order_by="ResumeVersion.version.desc()")


class ResumeVersion(Base, TimestampMixin):
    """Immutable snapshot. `sections` is an ordered list of {type, title, items[]} – document content, so JSON is appropriate."""

    __tablename__ = "resume_versions"
    id: Mapped[str] = uuid_pk()
    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    sections: Mapped[list] = mapped_column(JSONB, default=list)
    note: Mapped[str | None] = mapped_column(Text)
