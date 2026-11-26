from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class ActivityEvent(Base, TimestampMixin):
    """User activity used for Career Analytics (job viewed, resource completed, mock interview, …)."""

    __tablename__ = "activity_events"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    kind: Mapped[str] = mapped_column(String(40), index=True)
    ref_id: Mapped[str | None] = mapped_column(String(36))


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"
    id: Mapped[str] = uuid_pk()
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    detail: Mapped[str | None] = mapped_column(Text)
