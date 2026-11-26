from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"
    id: Mapped[str] = uuid_pk()
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(60), default="Core")


class SkillGap(Base, TimestampMixin):
    """One analysis run, against a target role or a specific job."""

    __tablename__ = "skill_gaps"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    target_type: Mapped[str] = mapped_column(String(20))  # ROLE | JOB
    target_role: Mapped[str | None] = mapped_column(String(160))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    summary: Mapped[str | None] = mapped_column(Text)
    items = relationship("SkillGapItem", cascade="all, delete-orphan", order_by="SkillGapItem.position")


class SkillGapItem(Base):
    __tablename__ = "skill_gap_items"
    id: Mapped[str] = uuid_pk()
    gap_id: Mapped[str] = mapped_column(ForeignKey("skill_gaps.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    current_level: Mapped[int] = mapped_column(Integer)
    required_level: Mapped[int] = mapped_column(Integer)
    importance: Mapped[str] = mapped_column(String(20))
    state: Mapped[str] = mapped_column(String(20))  # STRONG | PARTIAL | MISSING
    recommended_action: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    skill = relationship("Skill")
