from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator


class SkillGapAnalyzeIn(BaseModel):
    target_type: Literal["ROLE", "JOB"]
    target_role: str | None = None
    job_id: str | None = None
    use_ai_actions: bool = False

    @model_validator(mode="after")
    def check(self):
        if self.target_type == "ROLE" and not self.target_role:
            raise ValueError("target_role is required for ROLE analysis")
        if self.target_type == "JOB" and not self.job_id:
            raise ValueError("job_id is required for JOB analysis")
        return self


class SkillGapItemOut(BaseModel):
    skill: str
    category: str
    current_level: int
    required_level: int
    importance: str
    state: str
    recommended_action: str | None


class SkillGapOut(BaseModel):
    id: str
    target_type: str
    target_role: str | None
    job_id: str | None
    created_at: datetime
    strong: list[SkillGapItemOut]
    partial: list[SkillGapItemOut]
    missing: list[SkillGapItemOut]
    estimated_hours: int
