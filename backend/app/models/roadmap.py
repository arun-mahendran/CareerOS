from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class LearningResource(Base, TimestampMixin):
    __tablename__ = "learning_resources"
    id: Mapped[str] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(120))
    url: Mapped[str] = mapped_column(String(400))
    category: Mapped[str] = mapped_column(String(60), index=True)
    difficulty: Mapped[str] = mapped_column(String(20))  # Beginner | Intermediate | Advanced
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"), index=True)
    skill = relationship("Skill")


class ResourceBookmark(Base, TimestampMixin):
    __tablename__ = "resource_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "resource_id"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    resource_id: Mapped[str] = mapped_column(ForeignKey("learning_resources.id", ondelete="CASCADE"))
    progress: Mapped[int] = mapped_column(Integer, default=0)


class Roadmap(Base, TimestampMixin):
    __tablename__ = "roadmaps"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    title: Mapped[str] = mapped_column(String(200))
    target_role: Mapped[str] = mapped_column(String(160))
    skill_gap_id: Mapped[str | None] = mapped_column(ForeignKey("skill_gaps.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    items = relationship("RoadmapItem", cascade="all, delete-orphan", order_by="RoadmapItem.position")


class RoadmapItem(Base, TimestampMixin):
    __tablename__ = "roadmap_items"
    id: Mapped[str] = uuid_pk()
    roadmap_id: Mapped[str] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(60))  # Foundation | Core Skills | Advanced Skills | Projects | Interview Readiness
    kind: Mapped[str] = mapped_column(String(20), default="LEARN")  # LEARN | PRACTICE | VERIFY
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str | None] = mapped_column(Text)
    hours: Mapped[int] = mapped_column(Integer, default=1)
    position: Mapped[int] = mapped_column(Integer, default=0)
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"))
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("learning_resources.id", ondelete="SET NULL"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resource = relationship("LearningResource")
