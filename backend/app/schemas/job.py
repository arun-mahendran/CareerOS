from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class JobSkillOut(BaseModel):
    name: str
    required_level: int
    importance: str


class SourceOut(BaseModel):
    key: str
    name: str
    kind: str
    is_demo: bool


class JobOut(BaseModel):
    id: str
    slug: str
    title: str
    company_id: str
    company: str
    location: str
    work_mode: str
    level: str
    salary: str | None
    description: str
    requirements: list[str]
    skills: list[JobSkillOut]
    posted_at: datetime
    updated_at: datetime | None
    freshness_days: int
    source: SourceOut
    official_url: str
    apply_url: str
    status: str
    saved: bool = False
    employment_type: str | None = None
    department: str | None = None
    first_seen_at: datetime | None = None
    posted_at_known: bool = True
    is_new: bool = False


class JobPageMeta(BaseModel):
    last_successful_sync: datetime | None
    configured_sources: int
    healthy_sources: int
    new_jobs: int
    new_window_hours: int
    includes_demo: bool


class JobPage(BaseModel):
    items: list[JobOut]
    total: int
    page: int
    page_size: int
    meta: JobPageMeta | None = None


class SkillAlignment(BaseModel):
    name: str
    your_level: int
    required_level: int
    importance: str


class JobMatchOut(BaseModel):
    job_id: str
    matched: list[SkillAlignment]
    partial: list[SkillAlignment]
    missing: list[SkillAlignment]
    experience_requirement_met: bool
    requirement_alignment: int  # % of required skills fully met
    disclaimer: str = (
        "Informational alignment between your profile and the listed requirements. "
        "It is not a prediction of interview or hiring outcomes."
    )


class SourceAdminOut(BaseModel):
    id: str
    key: str
    name: str
    kind: str
    is_demo: bool
    enabled: bool
    status: str
    last_success_at: datetime | None
    last_checked_at: datetime | None
    last_error: str | None
    provider: str | None = None
    board_token: str | None = None
    region: str = "global"
    company_id: str | None = None
    company_name: str | None = None
    careers_url: str | None = None
    validated_at: datetime | None = None
    monitored: bool = False
    syncing: bool = False
    job_count: int = 0
    last_fetched_count: int = 0
    last_new_count: int = 0
    last_updated_count: int = 0
    last_expired_count: int = 0


Provider = Literal["greenhouse", "lever", "ashby"]
TOKEN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$"


class SourceCreate(BaseModel):
    provider: Provider
    board_token: str = Field(pattern=TOKEN)
    region: Literal["global", "eu"] = "global"
    company_id: str | None = None
    company_name: str | None = Field(None, min_length=1, max_length=200)
    careers_url: HttpUrl | None = None
    enabled: bool = True


class SourceUpdate(BaseModel):
    enabled: bool | None = None
    board_token: str | None = Field(None, pattern=TOKEN)
    region: Literal["global", "eu"] | None = None
    careers_url: HttpUrl | None = None
    name: str | None = Field(None, min_length=1, max_length=160)


class SyncResultOut(BaseModel):
    ok: bool
    fetched: int = 0
    new: int = 0
    updated: int = 0
    unchanged: int = 0
    expired: int = 0
    notifications: int = 0
    error_kind: str | None = None
    error: str | None = None
    skipped: bool = False


class JobAdminUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
