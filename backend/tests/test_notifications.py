"""Isolated notification endpoint tests; never connect to a deployed database."""
import os
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "notification-tests-only-not-a-production-secret"

from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Notification
from app.routers.notifications import router
from app.services import notification_service


@pytest.fixture
def context():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    # This temporary SQLite test needs only the existing notifications table.
    Notification.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as db:
        current = SimpleNamespace(id="owner")
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: current
        with TestClient(app) as client:
            yield db, client, current
    engine.dispose()


def add(db, owner="owner", count=1):
    rows = [Notification(user_id=owner, type="SYSTEM", title=f"Update {i}") for i in range(count)]
    db.add_all(rows)
    db.commit()
    return rows


def test_empty_unread_count(context):
    _, client, _ = context
    assert client.get("/notifications/unread-count").json() == {"count": 0}
    assert client.get("/notifications").json() == []


def test_count_not_limited_to_list_size(context):
    db, client, _ = context
    add(db, count=105)
    assert client.get("/notifications/unread-count").json() == {"count": 105}
    assert len(client.get("/notifications").json()) == 100


def test_last_read_and_new_notification(context):
    db, client, _ = context
    row = add(db)[0]
    assert client.get("/notifications/unread-count").json()["count"] == 1
    assert client.put(f"/notifications/{row.id}/read").status_code == 200
    assert client.get("/notifications/unread-count").json()["count"] == 0
    add(db)
    assert client.get("/notifications/unread-count").json()["count"] == 1


def test_user_isolation_and_mark_all(context):
    db, client, current = context
    add(db, count=2)
    other = add(db, owner="other")[0]
    assert client.get("/notifications/unread-count").json()["count"] == 2
    assert len(client.get("/notifications").json()) == 2
    assert client.put(f"/notifications/{other.id}/read").status_code == 404
    assert client.put("/notifications/read-all").status_code == 204
    assert client.get("/notifications/unread-count").json()["count"] == 0
    current.id = "other"
    assert client.get("/notifications/unread-count").json()["count"] == 1


def test_failure_is_not_a_successful_zero_count(context, monkeypatch):
    _, client, _ = context
    def fail(*args):
        raise RuntimeError("Database unavailable")
    monkeypatch.setattr(notification_service, "unread_count", fail)
    with pytest.raises(RuntimeError, match="Database unavailable"):
        client.get("/notifications/unread-count")