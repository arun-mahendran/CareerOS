from pydantic import BaseModel

from app.schemas import ORM


class CompanyOut(ORM):
    id: str
    slug: str
    name: str
    industry: str | None = None
    headquarters: str | None = None
    size: str | None = None
    description: str | None = None
    website_url: str | None = None
    careers_url: str | None = None
    logo_url: str | None = None
    active_jobs: int = 0
    followed: bool = False


class CompanyIn(BaseModel):
    slug: str
    name: str
    industry: str | None = None
    headquarters: str | None = None
    size: str | None = None
    description: str | None = None
    website_url: str | None = None
    careers_url: str | None = None
    logo_url: str | None = None
