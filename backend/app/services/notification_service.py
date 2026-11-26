from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Notification
from app.services import get_owned
from app.utils import utcnow


def list_for(db: Session, user_id: str, unread_only: bool = False) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    return list(db.scalars(stmt.order_by(Notification.created_at.desc()).limit(100)).all())


def unread_count(db: Session, user_id: str) -> int:
    return db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.read_at.is_(None)
    )) or 0


def mark_read(db: Session, user_id: str, nid: str) -> Notification:
    n = get_owned(db, Notification, nid, user_id)
    n.read_at = n.read_at or utcnow()
    db.commit()
    return n


def mark_all(db: Session, user_id: str) -> None:
    db.execute(update(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None)).values(read_at=utcnow()))
    db.commit()


def notify(db: Session, user_id: str, type_: str, title: str, body: str | None = None, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, type=type_, title=title, body=body, link=link))
