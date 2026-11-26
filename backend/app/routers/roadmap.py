from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.models import LearningResource, Profile, ResourceBookmark, Roadmap, SkillGapItem, SkillGap
from app.routers import DB, CurrentUser
from app.schemas.roadmap import (
    BookmarkProgressIn, CompleteIn, ProgressIn, ResourceOut, RoadmapGenerateIn, RoadmapItemOut, RoadmapOut,
)
from app.services import get_owned, roadmap_service

router = APIRouter(prefix="/roadmaps", tags=["Roadmap"])
resources = APIRouter(prefix="/resources", tags=["Resources"])


@router.post("/generate", response_model=RoadmapOut, status_code=status.HTTP_201_CREATED)
def generate(body: RoadmapGenerateIn, user: CurrentUser, db: DB):
    rm = roadmap_service.generate(db, user.id, body.target_role, body.skill_gap_id, body.desired_skills)
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="ROADMAP_GENERATED", ref_id=rm.id))
    db.commit()
    return roadmap_service.out(rm)


@router.get("", response_model=list[RoadmapOut])
def list_roadmaps(user: CurrentUser, db: DB):
    rows = db.scalars(select(Roadmap).where(Roadmap.user_id == user.id).order_by(Roadmap.created_at.desc())).all()
    return [roadmap_service.out(r) for r in rows]


@router.get("/{roadmap_id}", response_model=RoadmapOut)
def get_roadmap(roadmap_id: str, user: CurrentUser, db: DB):
    return roadmap_service.out(get_owned(db, Roadmap, roadmap_id, user.id))


@router.put("/{roadmap_id}/progress", response_model=RoadmapOut)
def progress(roadmap_id: str, body: ProgressIn, user: CurrentUser, db: DB):
    return roadmap_service.out(roadmap_service.set_progress(db, user.id, roadmap_id, body.completed_item_ids))


@router.put("/items/{item_id}/complete", response_model=RoadmapItemOut)
def complete(item_id: str, body: CompleteIn, user: CurrentUser, db: DB):
    return roadmap_service.set_item(db, user.id, item_id, body.completed)


def _res_out(r: LearningResource, bm: dict[str, ResourceBookmark]) -> dict:
    b = bm.get(r.id)
    return {**{k: getattr(r, k) for k in ("id", "title", "provider", "url", "category", "difficulty", "estimated_minutes")},
            "bookmarked": b is not None, "progress": b.progress if b else 0}


def _bookmarks(db, uid) -> dict[str, ResourceBookmark]:
    return {b.resource_id: b for b in db.scalars(select(ResourceBookmark).where(ResourceBookmark.user_id == uid))}


@resources.get("", response_model=list[ResourceOut])
def list_resources(user: CurrentUser, db: DB, category: str | None = None, difficulty: str | None = None):
    stmt = select(LearningResource).order_by(LearningResource.title)
    if category:
        stmt = stmt.where(LearningResource.category == category)
    if difficulty:
        stmt = stmt.where(LearningResource.difficulty == difficulty)
    bm = _bookmarks(db, user.id)
    return [_res_out(r, bm) for r in db.scalars(stmt).all()]


@resources.get("/recommended", response_model=list[ResourceOut])
def recommended(user: CurrentUser, db: DB):
    """Resources tied to the skills in the user's latest open skill gaps."""
    gap = db.scalar(select(SkillGap).where(SkillGap.user_id == user.id).order_by(SkillGap.created_at.desc()))
    skill_ids = [i.skill_id for i in gap.items if i.state != "STRONG"] if gap else []
    bm = _bookmarks(db, user.id)
    if not skill_ids:
        return [_res_out(r, bm) for r in db.scalars(select(LearningResource).limit(6)).all()]
    return [_res_out(r, bm) for r in db.scalars(select(LearningResource).where(LearningResource.skill_id.in_(skill_ids))).all()]


@resources.get("/{resource_id}", response_model=ResourceOut)
def get_resource(resource_id: str, user: CurrentUser, db: DB):
    r = db.get(LearningResource, resource_id)
    if not r:
        raise HTTPException(404, "Resource not found")
    return _res_out(r, _bookmarks(db, user.id))


@resources.post("/{resource_id}/bookmark", response_model=ResourceOut)
def bookmark(resource_id: str, user: CurrentUser, db: DB, body: BookmarkProgressIn | None = None):
    r = db.get(LearningResource, resource_id)
    if not r:
        raise HTTPException(404, "Resource not found")
    b = db.scalar(select(ResourceBookmark).where(ResourceBookmark.user_id == user.id, ResourceBookmark.resource_id == r.id))
    if not b:
        b = ResourceBookmark(user_id=user.id, resource_id=r.id)
        db.add(b)
    if body:
        b.progress = body.progress
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="LEARNING_SAVED", ref_id=r.id))
    db.commit()
    return _res_out(r, _bookmarks(db, user.id))


@resources.delete("/{resource_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def unbookmark(resource_id: str, user: CurrentUser, db: DB):
    b = db.scalar(select(ResourceBookmark).where(ResourceBookmark.user_id == user.id, ResourceBookmark.resource_id == resource_id))
    if b:
        db.delete(b)
        db.commit()


_ = (Profile, SkillGapItem)  # imported for type clarity
