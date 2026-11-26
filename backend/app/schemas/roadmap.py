from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas import ORM


class ResourceOut(ORM):
    id: str
    title: str
    provider: str
    url: str
    category: str
    difficulty: str
    estimated_minutes: int
    bookmarked: bool = False
    progress: int = 0


class RoadmapItemOut(ORM):
    id: str
    stage: str
    kind: str
    title: str
    detail: str | None
    hours: int
    position: int
    completed_at: datetime | None
    resource: ResourceOut | None = None


class RoadmapOut(ORM):
    id: str
    title: str
    target_role: str
    is_active: bool
    created_at: datetime
    progress: int
    items: list[RoadmapItemOut]


class RoadmapGenerateIn(BaseModel):
    target_role: str | None = None
    skill_gap_id: str | None = None
    desired_skills: list[str] = []


class ProgressIn(BaseModel):
    completed_item_ids: list[str]


class CompleteIn(BaseModel):
    completed: bool = True


class BookmarkProgressIn(BaseModel):
    progress: int = Field(default=0, ge=0, le=100)
