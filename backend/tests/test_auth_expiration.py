import os
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "auth-tests-only-not-a-production-secret"
from datetime import timedelta
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from app.core import security
from app.services import auth_service


class Database:
    def __init__(self, user): self.user = user
    def get(self, model, id): return self.user if id == self.user.id else None
    def commit(self): pass


@pytest.fixture
def session():
    user = SimpleNamespace(id="owner", is_active=True, token_version=0)
    return user, Database(user)


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_expired_access_is_rejected(session):
    _, db = session
    token = security._token("owner", "access", timedelta(seconds=-1), "CANDIDATE")
    with pytest.raises(HTTPException) as failure:
        security.get_current_user(credentials(token), db)
    assert failure.value.status_code == 401


def test_invalid_and_expired_refresh_are_rejected(session):
    _, db = session
    expired = security._token("owner", "refresh", timedelta(seconds=-1), "CANDIDATE")
    for token in ["malformed", expired, security.create_access_token("owner", "CANDIDATE")]:
        with pytest.raises(HTTPException) as failure:
            auth_service.refresh(db, token)
        assert failure.value.status_code == 401


def test_logout_revokes_access_and_refresh(session):
    user, db = session
    access = security.create_access_token(user.id, "CANDIDATE", user.token_version)
    refresh = security.create_refresh_token(user.id, "CANDIDATE", user.token_version)
    assert security.get_current_user(credentials(access), db) is user
    auth_service.logout_everywhere(db, user)
    assert user.token_version == 1
    for action in [lambda: security.get_current_user(credentials(access), db), lambda: auth_service.refresh(db, refresh)]:
        with pytest.raises(HTTPException) as failure: action()
        assert failure.value.status_code == 401


def test_valid_refresh_uses_existing_issue_flow(session, monkeypatch):
    user, db = session
    monkeypatch.setattr(auth_service, "issue_tokens", lambda verified: {"user_id": verified.id})
    token = security.create_refresh_token(user.id, "CANDIDATE", user.token_version)
    assert auth_service.refresh(db, token) == {"user_id": "owner"}