from fastapi import APIRouter, status
from sqlalchemy import select

from app.models import Application
from app.routers import DB, CurrentUser
from app.schemas.application import ApplicationIn, ApplicationOut, ApplicationUpdate, NoteIn, StatusIn
from app.services import application_service as svc
from app.services import get_owned

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=list[ApplicationOut])
def list_apps(user: CurrentUser, db: DB, status_: str | None = None):
    stmt = select(Application).where(Application.user_id == user.id)
    if status_:
        stmt = stmt.where(Application.status == status_)
    return [svc.out(a) for a in db.scalars(stmt.order_by(Application.updated_at.desc())).all()]


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create(body: ApplicationIn, user: CurrentUser, db: DB):
    app_row = svc.create(db, user.id, body)
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="APPLICATION_CREATED", ref_id=app_row.id))
    db.commit()
    return svc.out(app_row)


@router.get("/{app_id}", response_model=ApplicationOut)
def get(app_id: str, user: CurrentUser, db: DB):
    return svc.out(get_owned(db, Application, app_id, user.id))


@router.put("/{app_id}", response_model=ApplicationOut)
def update(app_id: str, body: ApplicationUpdate, user: CurrentUser, db: DB):
    a = get_owned(db, Application, app_id, user.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return svc.out(a)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(app_id: str, user: CurrentUser, db: DB):
    db.delete(get_owned(db, Application, app_id, user.id))
    db.commit()


@router.put("/{app_id}/status", response_model=ApplicationOut)
def set_status(app_id: str, body: StatusIn, user: CurrentUser, db: DB):
    return svc.out(svc.set_status(db, user.id, app_id, body.status))


@router.post("/{app_id}/notes", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def add_note(app_id: str, body: NoteIn, user: CurrentUser, db: DB):
    return svc.out(svc.add_note(db, user.id, app_id, body.body))
