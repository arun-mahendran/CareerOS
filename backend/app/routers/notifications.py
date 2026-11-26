from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select

from app.models import CalendarEvent
from app.routers import DB, CurrentUser
from app.schemas.application import CalendarEventIn, CalendarEventOut, CalendarEventPatch
from app.schemas.notification import NotificationOut, UnreadCountOut
from app.services import get_owned, notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])
calendar = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: CurrentUser, db: DB, unread: bool = False):
    return notification_service.list_for(db, user.id, unread)


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(user: CurrentUser, db: DB):
    return {"count": notification_service.unread_count(db, user.id)}


@router.put("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(user: CurrentUser, db: DB):
    notification_service.mark_all(db, user.id)


@router.put("/{notification_id}/read", response_model=NotificationOut)
def read(notification_id: str, user: CurrentUser, db: DB):
    return notification_service.mark_read(db, user.id, notification_id)


@calendar.get("/events", response_model=list[CalendarEventOut])
def events(user: CurrentUser, db: DB, start: datetime | None = None, end: datetime | None = None,
           type: str | None = None):
    stmt = select(CalendarEvent).where(CalendarEvent.user_id == user.id)
    if type:
        stmt = stmt.where(CalendarEvent.type == type)
    if start:
        stmt = stmt.where(CalendarEvent.starts_at >= start)
    if end:
        stmt = stmt.where(CalendarEvent.starts_at <= end)
    return db.scalars(stmt.order_by(CalendarEvent.starts_at)).all()


@calendar.get("/events/{event_id}", response_model=CalendarEventOut)
def get_event(event_id: str, user: CurrentUser, db: DB):
    return get_owned(db, CalendarEvent, event_id, user.id)


@calendar.patch("/events/{event_id}", response_model=CalendarEventOut)
def patch_event(event_id: str, body: CalendarEventPatch, user: CurrentUser, db: DB):
    e = get_owned(db, CalendarEvent, event_id, user.id)
    current = CalendarEventOut.model_validate(e, from_attributes=True).model_dump(exclude={"id"})
    current.update(body.model_dump(exclude_unset=True))
    try:
        merged = CalendarEventIn(**current)  # re-validate title, category and start/end order
    except ValidationError as err:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, [{"loc": list(x["loc"]), "msg": x["msg"]} for x in err.errors()])
    for k, v in merged.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return e


@calendar.post("/events", response_model=CalendarEventOut, status_code=status.HTTP_201_CREATED)
def create_event(body: CalendarEventIn, user: CurrentUser, db: DB):
    e = CalendarEvent(user_id=user.id, **body.model_dump())
    db.add(e)
    db.commit()
    return e


@calendar.put("/events/{event_id}", response_model=CalendarEventOut)
def update_event(event_id: str, body: CalendarEventIn, user: CurrentUser, db: DB):
    e = get_owned(db, CalendarEvent, event_id, user.id)
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return e


@calendar.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: str, user: CurrentUser, db: DB):
    db.delete(get_owned(db, CalendarEvent, event_id, user.id))
    db.commit()
