"""The development seed must not create demo workspace or job data."""
from types import SimpleNamespace

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import seed
from app.core.database import Base
from app.models import Company, Job, Profile, Role, User


def test_seed_creates_only_the_configured_admin(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    tables = [Base.metadata.tables[n] for n in ("users", "profiles", "companies", "jobs")]
    Base.metadata.create_all(engine, tables=tables)  # test-only; real databases use Alembic
    monkeypatch.setattr(seed, "get_settings", lambda: SimpleNamespace(ADMIN_EMAIL="owner@example.com", ADMIN_PASSWORD="eightchars"))
    monkeypatch.setattr(seed, "SessionLocal", lambda: Session(engine, expire_on_commit=False))

    seed.run()

    with Session(engine) as db:
        users = db.scalars(select(User)).all()
        assert len(users) == 1
        assert users[0].email == "owner@example.com"
        assert users[0].role == Role.ADMIN
        assert users[0].password_hash != "eightchars"
        assert db.scalar(select(Profile).where(Profile.user_id == users[0].id)).full_name == "CareerOS Admin"
        assert db.scalars(select(Company)).all() == []
        assert db.scalars(select(Job)).all() == []
    engine.dispose()
