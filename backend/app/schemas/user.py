from datetime import date

from pydantic import BaseModel, Field

from app.schemas import ORM


class UserOut(ORM):
    id: str
    email: str
    role: str
    full_name: str | None = None
    avatar_url: str | None = None


class ProfileOut(ORM):
    full_name: str
    headline: str | None = None
    location: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    target_role: str
    onboarded: bool


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    headline: str | None = None
    location: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    target_role: str | None = None
    onboarded: bool | None = None


class EducationIn(BaseModel):
    institution: str
    degree: str
    field: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    grade: str | None = None


class EducationOut(EducationIn, ORM):
    id: str


class ExperienceIn(BaseModel):
    company: str
    title: str
    employment_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None


class ExperienceOut(ExperienceIn, ORM):
    id: str


class UserSkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    level: int = Field(default=50, ge=0, le=100)
    category: str = "Core"


class UserSkillOut(BaseModel):
    id: str
    skill_id: str
    name: str
    category: str
    level: int


class ProjectIn(BaseModel):
    name: str
    description: str | None = None
    url: str | None = None
    technologies: str | None = None


class ProjectOut(ProjectIn, ORM):
    id: str


class CertificationIn(BaseModel):
    name: str
    issuer: str | None = None
    issued_on: date | None = None
    credential_url: str | None = None


class CertificationOut(CertificationIn, ORM):
    id: str


class CareerGoalIn(BaseModel):
    primary_role: str
    secondary_roles: list[str] = []
    preferred_locations: list[str] = []
    industries: list[str] = []
    experience_level: str | None = None
    preferred_companies: list[str] = []


class CareerGoalOut(CareerGoalIn):
    id: str
    is_active: bool
