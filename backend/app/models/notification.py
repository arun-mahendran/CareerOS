from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk

NOTIFICATION_TYPES = ("JOB_ALERT", "COMPANY_ALERT", "MATCH_ALERT", "ROADMAP", "INTERVIEW", "APPLICATION", "SYSTEM")
EVENT_TYPES = ("INTERVIEW", "ASSESSMENT", "APPLICATION_DEADLINE", "PREPARATION", "LEARNING", "REMINDER", "OTHER",
               "PREP_TASK", "ROADMAP_MILESTONE", "DEADLINE")  # last three: legacy values kept readable


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(200))  # one notification per discovery event


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    type: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    location: Mapped[str | None] = mapped_column(String(200))
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    application_id: Mapped[str | None] = mapped_column(String(36))
    interview_id: Mapped[str | None] = mapped_column(String(36))
