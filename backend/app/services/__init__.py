from fastapi import HTTPException, status
from sqlalchemy.orm import Session


def get_owned(db: Session, model, obj_id: str, user_id: str):
    """Fetch a row that must belong to the user; 404 otherwise (never reveal others' rows)."""
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "user_id", None) != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return obj


def split_csv(v: str | None) -> list[str]:
    return [x.strip() for x in (v or "").split(",") if x.strip()]


def join_csv(v: list[str]) -> str:
    return ", ".join(x.strip() for x in v if x.strip())
