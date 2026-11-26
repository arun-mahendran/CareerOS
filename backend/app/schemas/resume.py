from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ResumeSection(BaseModel):
    type: str  # summary | experience | education | skills | projects | certifications | custom
    title: str
    items: list[dict[str, Any]] = []


class ResumeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    template: str = "classic"
    is_master: bool = False
    target_job_id: str | None = None
    sections: list[ResumeSection] | None = None  # omitted => build from profile facts


class ResumeUpdate(BaseModel):
    title: str | None = None
    template: str | None = None
    target_job_id: str | None = None
    sections: list[ResumeSection] | None = None
    note: str | None = None


class ResumeOut(BaseModel):
    id: str
    title: str
    template: str
    is_master: bool
    target_job_id: str | None
    version: int
    sections: list[ResumeSection]
    updated_at: datetime


class TailorIn(BaseModel):
    job_id: str


class Suggestion(BaseModel):
    section: str
    original: str | None
    suggested: str
    reason: str


class SuggestionsOut(BaseModel):
    suggestions: list[Suggestion]
    note: str = "Suggestions only use facts already in your resume/profile. Review and edit before applying."


class AnalyzeOut(BaseModel):
    job_id: str | None
    covered_keywords: list[str]
    missing_keywords: list[str]
    alignment: int
    tips: list[str]
