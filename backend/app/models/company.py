from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class Company(Base, TimestampMixin):
    __tablename__ = "companies"
    id: Mapped[str] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    industry: Mapped[str | None] = mapped_column(String(120))
    headquarters: Mapped[str | None] = mapped_column(String(160))
    size: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(Text)
    website_url: Mapped[str | None] = mapped_column(String(300))
    careers_url: Mapped[str | None] = mapped_column(String(300))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    jobs = relationship("Job", back_populates="company")


class FollowedCompany(Base, TimestampMixin):
    __tablename__ = "followed_companies"
    __table_args__ = (UniqueConstraint("user_id", "company_id"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
