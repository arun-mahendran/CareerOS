"""Owner-scoped workspace endpoints used by the CareerOS screens.

    GET    /api/v1/data/{resource}?eq.<col>=<v>&order=<col>.asc|desc&limit=n   list own rows
    POST   /api/v1/data/{resource}            {"rows": [...]}                    create
    PUT    /api/v1/data/{resource}            {"rows": [...], "on_conflict"}     create-or-update (upsert)
    PATCH  /api/v1/data/{resource}?eq...      {...fields}                        update own matching rows
    DELETE /api/v1/data/{resource}?eq...                                         delete own matching rows

`user_id` is ALWAYS taken from the signed-in session. Any user_id / id supplied by the client for ownership is
ignored, so one user can never read or change another user's records. Only whitelisted columns are writable.
"""

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request, status
from sqlalchemy import asc, delete, desc, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from app.models import (
    InterviewSession, LearningProgress, Profile, ResumeDocument, RoadmapPreference, RoadmapProgress, RoadmapStudyLog,
    SkillRating, TrackedApplication,
)
from app.routers import DB, CurrentUser
from app.utils import utcnow

router = APIRouter(prefix="/data", tags=["Workspace data"])

# resource -> (model, writable columns, conflict key columns for upsert)
RESOURCES: dict[str, tuple[Any, set[str], list[str]]] = {
    "resumes": (ResumeDocument, {"title", "target_role", "template", "target_job_id", "data"}, ["id"]),
    "saved_jobs": (TrackedApplication, {
        "job_id", "status", "company", "title", "location", "job_type", "job_url", "career_url", "salary", "notes",
        "applied_on", "follow_up_on", "follow_up_done", "follow_up_note", "interview_at", "resume_id", "history"},
        ["user_id", "job_id"]),
    "roadmap_progress": (RoadmapProgress, {"step_id", "status", "completed_at", "minutes_logged"}, ["user_id", "step_id"]),
    "roadmap_preferences": (RoadmapPreference, {"weekly_hours", "pace", "skill_level", "target_date", "priority_skills"}, ["user_id"]),
    "roadmap_study_logs": (RoadmapStudyLog, {"step_id", "minutes", "logged_on"}, ["id"]),
    "user_skills": (SkillRating, {"skill", "level", "source"}, ["user_id", "skill"]),
    "learning_resource_progress": (LearningProgress, {"resource_url", "saved", "status", "completed_at"}, ["user_id", "resource_url"]),
    "interview_sessions": (InterviewSession, {
        "interview_type", "target_role", "company", "job_id", "difficulty", "practice_mode", "questions", "answers",
        "feedback", "status", "current_index"}, ["id"]),
}

ENUMS = {
    ("saved_jobs", "status"): {"saved", "applied", "assessment", "interviewing", "offer", "rejected", "withdrawn"},
    ("roadmap_progress", "status"): {"in_progress", "completed", "skipped"},
    ("roadmap_preferences", "pace"): {"relaxed", "steady", "intensive"},
    ("roadmap_preferences", "skill_level"): {"beginner", "intermediate", "advanced"},
    ("learning_resource_progress", "status"): {"not_started", "in_progress", "completed"},
    ("interview_sessions", "interview_type"): {"technical", "hr", "role", "company"},
    ("interview_sessions", "practice_mode"): {"guided", "mock"},
    ("interview_sessions", "status"): {"in_progress", "completed"},
    ("user_skills", "source"): {"self", "assessment", "project"},
}


def _resource(name: str):
    if name not in RESOURCES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown resource")
    return RESOURCES[name]


def _coerce(model, col: str, value):
    if value is None:
        return None
    py = getattr(model, col).type.python_type
    try:
        if py is datetime and isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        if py is date and isinstance(value, str):
            return date.fromisoformat(value[:10])
        if py is int and not isinstance(value, bool):
            return int(value)
        if py is bool and isinstance(value, str):
            return value.lower() == "true"
    except (ValueError, TypeError):
        raise HTTPException(422, f"Invalid value for {col}")
    return value


def _clean(name: str, row: dict, model, writable: set[str]) -> dict:
    out = {}
    for k, v in row.items():
        if k not in writable:
            continue  # user_id, id, timestamps and unknown fields are ignored
        if (name, k) in ENUMS and v is not None and v not in ENUMS[(name, k)]:
            raise HTTPException(422, f"Invalid value for {k}")
        out[k] = _coerce(model, k, v)
    if name == "user_skills" and "level" in out and not 0 <= out["level"] <= 4:
        raise HTTPException(422, "Skill level must be between 0 and 4")
    if name == "roadmap_study_logs" and "minutes" in out and not 1 <= out["minutes"] <= 1440:
        raise HTTPException(422, "Minutes must be between 1 and 1440")
    return out


def _filters(request: Request, model) -> list:
    conds = []
    for key, val in request.query_params.items():
        if not key.startswith("eq."):
            continue
        col = key[3:]
        if col == "user_id" or not hasattr(model, col):
            continue
        conds.append(getattr(model, col) == _coerce(model, col, val))
    return conds


def _row(obj) -> dict:
    out = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.key)
        out[c.key] = v.isoformat() if isinstance(v, (datetime, date)) else v
    return out


def _profile_row(user) -> dict:
    p = user.profile
    return {"id": user.id, "full_name": p.full_name if p else None, "target_role": p.target_role if p else None}


# ---------- profile (special-cased: one row per user) ----------
@router.get("/profiles")
def get_profile(user: CurrentUser):
    return [_profile_row(user)]


@router.patch("/profiles")
def patch_profile(user: CurrentUser, db: DB, body: dict = Body(...)):
    p = user.profile or Profile(user_id=user.id, full_name="")
    if "full_name" in body:
        p.full_name = (body["full_name"] or "")[:160]
    if body.get("target_role"):
        p.target_role = str(body["target_role"])[:160]
    db.add(p)
    db.commit()
    db.refresh(user)
    return [_profile_row(user)]


# ---------- generic owner-scoped resources ----------
@router.get("/{name}")
def list_rows(name: str, request: Request, user: CurrentUser, db: DB):
    model, _, _ = _resource(name)
    q = select(model).where(model.user_id == user.id, *_filters(request, model))
    order = request.query_params.get("order")
    if order:
        col, _, direction = order.partition(".")
        if hasattr(model, col):
            q = q.order_by(desc(getattr(model, col)) if direction == "desc" else asc(getattr(model, col)))
    limit = request.query_params.get("limit")
    q = q.limit(min(int(limit), 500) if limit and limit.isdigit() else 500)
    return [_row(r) for r in db.scalars(q)]


@router.post("/{name}", status_code=status.HTTP_201_CREATED)
def create_rows(name: str, user: CurrentUser, db: DB, body: dict = Body(...)):
    model, writable, _ = _resource(name)
    created = []
    for raw in body.get("rows", [])[:200]:
        obj = model(**_clean(name, raw, model, writable), user_id=user.id)
        db.add(obj)
        created.append(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This already exists.")
    for o in created:
        db.refresh(o)
    return [_row(o) for o in created]


@router.put("/{name}")
def upsert_rows(name: str, user: CurrentUser, db: DB, body: dict = Body(...)):
    model, writable, key = _resource(name)
    if key == ["id"]:
        raise HTTPException(400, "Use POST to create and PATCH to update this resource")
    out = []
    for raw in body.get("rows", [])[:200]:
        values = {**_clean(name, raw, model, writable), "user_id": user.id}
        if hasattr(model, "updated_at"):
            values["updated_at"] = utcnow()
        missing = [k for k in key if k not in values]
        if missing:
            raise HTTPException(422, f"Missing {', '.join(missing)}")
        update = {k: v for k, v in values.items() if k not in key}
        stmt = pg_insert(model).values(**values)
        stmt = stmt.on_conflict_do_update(index_elements=key, set_=update) if update else stmt.on_conflict_do_nothing()
        db.execute(stmt.returning(*model.__table__.columns))
        out.append(values)
    db.commit()
    return [{k: (v.isoformat() if isinstance(v, (datetime, date)) else v) for k, v in r.items()} for r in out]


@router.patch("/{name}")
def update_rows(name: str, request: Request, user: CurrentUser, db: DB, body: dict = Body(...)):
    model, writable, _ = _resource(name)
    conds = _filters(request, model)
    if not conds:
        raise HTTPException(400, "A filter is required")
    values = _clean(name, body, model, writable)
    rows = list(db.scalars(select(model).where(model.user_id == user.id, *conds)))
    for r in rows:
        for k, v in values.items():
            setattr(r, k, v)
        if hasattr(r, "updated_at"):
            r.updated_at = utcnow()
    db.commit()
    return [_row(r) for r in rows]


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rows(name: str, request: Request, user: CurrentUser, db: DB):
    model, _, _ = _resource(name)
    conds = _filters(request, model)
    if not conds:
        raise HTTPException(400, "A filter is required")
    db.execute(delete(model).where(model.user_id == user.id, *conds))
    db.commit()
