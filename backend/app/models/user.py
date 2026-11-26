import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.models._base import user_fk, uuid_pk


class Role(str, enum.Enum):
    CANDIDATE = "CANDIDATE"
    ADMIN = "ADMIN"


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[str] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), default=Role.CANDIDATE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)  # bump to invalidate refresh tokens
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(Base, TimestampMixin):
    __tablename__ = "profiles"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    full_name: Mapped[str] = mapped_column(String(160))
    headline: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(160))
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(300))
    github_url: Mapped[str | None] = mapped_column(String(300))
    portfolio_url: Mapped[str | None] = mapped_column(String(300))
    target_role: Mapped[str] = mapped_column(String(160), default="Frontend Engineer")
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User] = relationship(back_populates="profile")


class Education(Base, TimestampMixin):
    __tablename__ = "education"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    institution: Mapped[str] = mapped_column(String(200))
    degree: Mapped[str] = mapped_column(String(160))
    field: Mapped[str | None] = mapped_column(String(160))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    grade: Mapped[str | None] = mapped_column(String(40))


class Experience(Base, TimestampMixin):
    __tablename__ = "experience"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    company: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(160))
    employment_type: Mapped[str | None] = mapped_column(String(40))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)


class UserSkill(Base, TimestampMixin):
    __tablename__ = "user_skills"
    __table_args__ = (UniqueConstraint("user_id", "skill_id"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer, default=50)  # 0-100 self-assessed
    skill = relationship("Skill")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(300))
    technologies: Mapped[str | None] = mapped_column(String(400))  # comma-separated, user-entered


class Certification(Base, TimestampMixin):
    __tablename__ = "certifications"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[str | None] = mapped_column(String(200))
    issued_on: Mapped[date | None] = mapped_column(Date)
    credential_url: Mapped[str | None] = mapped_column(String(300))


class CareerGoal(Base, TimestampMixin):
    __tablename__ = "career_goals"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    primary_role: Mapped[str] = mapped_column(String(160))
    secondary_roles: Mapped[str | None] = mapped_column(String(400))
    preferred_locations: Mapped[str | None] = mapped_column(String(400))
    industries: Mapped[str | None] = mapped_column(String(400))
    experience_level: Mapped[str | None] = mapped_column(String(40))
    preferred_companies: Mapped[str | None] = mapped_column(String(400))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ConnectedAccount(Base, TimestampMixin):
    __tablename__ = "connected_accounts"
    __table_args__ = (UniqueConstraint("user_id", "provider"),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = user_fk()
    provider: Mapped[str] = mapped_column(String(40))
    external_id: Mapped[str | None] = mapped_column(String(200))
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan: Mapped[str] = mapped_column(String(40), default="FREE")
    status: Mapped[str] = mapped_column(String(40), default="ACTIVE")
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
