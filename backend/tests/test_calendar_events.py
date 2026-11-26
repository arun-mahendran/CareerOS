"""Calendar event endpoints: owner isolation, validation and edits; isolated SQLite only."""
import os
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "calendar-tests-only-not-a-production-secret"

from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import CalendarEvent
from app.routers.notifications import calendar


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    CalendarEvent.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as db:
        current = SimpleNamespace(id="owner")
        app = FastAPI()
        app.include_router(calendar)
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: current
        with TestClient(app) as client:
            yield client, current
    engine.dispose()


BODY = {"type": "INTERVIEW", "title": "Onsite", "starts_at": "2026-11-03T10:00:00Z", "ends_at": "2026-11-03T11:00:00Z",
        "location": "Remote"}


def test_create_and_patch_updates_same_event(ctx):
    client, _ = ctx
    e = client.post("/calendar/events", json=BODY).json()
    r = client.patch(f"/calendar/events/{e['id']}", json={"title": "Final round"})
    assert r.status_code == 200 and r.json()["id"] == e["id"] and r.json()["title"] == "Final round"
    assert len(client.get("/calendar/events").json()) == 1


def test_end_before_start_rejected(ctx):
    client, _ = ctx
    assert client.post("/calendar/events", json={**BODY, "ends_at": "2026-11-03T09:00:00Z"}).status_code == 422
    e = client.post("/calendar/events", json=BODY).json()
    assert client.patch(f"/calendar/events/{e['id']}", json={"ends_at": "2026-11-03T09:00:00Z"}).status_code == 422


def test_blank_title_and_unknown_category_rejected(ctx):
    client, _ = ctx
    assert client.post("/calendar/events", json={**BODY, "title": "  "}).status_code == 422
    assert client.post("/calendar/events", json={**BODY, "type": "PARTY"}).status_code == 422


def test_other_user_cannot_read_edit_or_delete(ctx):
    client, current = ctx
    e = client.post("/calendar/events", json=BODY).json()
    current.id = "intruder"
    assert client.get("/calendar/events").json() == []
    assert client.get(f"/calendar/events/{e['id']}").status_code == 404
    assert client.patch(f"/calendar/events/{e['id']}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/calendar/events/{e['id']}").status_code == 404
