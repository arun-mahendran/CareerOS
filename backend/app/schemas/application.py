from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.application import AppStatus


class ApplicationIn(BaseModel):
    job_id: str | None = None
    company_name: str | None = None
    role_title: str | None = None
    status: AppStatus = AppStatus.SAVED
    applied_on: date | None = None
    deadline: date | None = None
    resume_id: str | None = None
    url: str | None = None


class ApplicationUpdate(BaseModel):
    applied_on: date | None = None
    deadline: date | None = None
    resume_id: str | None = None
    url: str | None = None


class StatusIn(BaseModel):
    status: AppStatus


class NoteIn(BaseModel):
    body: str


class NoteOut(BaseModel):
    id: str
    body: str
    created_at: datetime


class HistoryOut(BaseModel):
    from_status: str | None
    to_status: str
    changed_at: datetime


class ApplicationOut(BaseModel):
    id: str
    job_id: str | None
    company_name: str
    role_title: str
    status: AppStatus
    applied_on: date | None
    deadline: date | None
    url: str | None
    created_at: datetime
    updated_at: datetime
    notes: list[NoteOut] = []
    history: list[HistoryOut] = []


class CalendarEventIn(BaseModel):
    type: str = "OTHER"
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    location: str | None = Field(default=None, max_length=200)
    all_day: bool = False
    starts_at: datetime
    ends_at: datetime | None = None
    application_id: str | None = None
    interview_id: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title is required")
        return v.strip()

    @field_validator("type")
    @classmethod
    def _type(cls, v: str) -> str:
        from app.models.notification import EVENT_TYPES
        if v not in EVENT_TYPES:
            raise ValueError("Unknown event category")
        return v

    @model_validator(mode="after")
    def _order(self):
        from datetime import timezone
        utc = lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc)  # noqa: E731 - stored values may be naive UTC
        if self.ends_at and utc(self.ends_at) < utc(self.starts_at):
            raise ValueError("End must not precede start")
        return self


class CalendarEventPatch(BaseModel):
    type: str | None = None
    title: str | None = None
    notes: str | None = None
    location: str | None = None
    all_day: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    application_id: str | None = None


class CalendarEventOut(CalendarEventIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
