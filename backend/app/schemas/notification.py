from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas import ORM


class UnreadCountOut(BaseModel):
    count: int = Field(ge=0)


class NotificationOut(ORM):
    id: str
    type: str
    title: str
    body: str | None
    link: str | None
    read_at: datetime | None
    created_at: datetime
