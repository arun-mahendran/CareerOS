import secrets
import time
from collections import defaultdict, deque
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_settings
from app.routers import DB, CurrentUser
from app.schemas.auth import LoginIn, RefreshIn, RegisterIn, TokenOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

STATE_COOKIE = "careeros_oauth_state"
GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"

# ---- simple per-IP rate limit for sensitive endpoints (single-process; use a shared store when scaling out)
_hits: dict[str, deque] = defaultdict(deque)


def _limit(request: Request, bucket: str, per_minute: int = 10) -> None:
    key = f"{bucket}:{request.client.host if request.client else 'unknown'}"
    now, q = time.monotonic(), _hits[key]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= per_minute:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Please wait a minute and try again.")
    q.append(now)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class CodeIn(BaseModel):
    code: str = Field(min_length=20, max_length=200)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DB, request: Request):
    _limit(request, "register", 5)
    return auth_service.register(db, body.name, body.email, body.password)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DB, request: Request):
    _limit(request, "login", 10)
    return auth_service.login(db, body.email, body.password)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: DB):
    return auth_service.refresh(db, body.refresh_token)


@router.get("/me")
def me(user: CurrentUser):
    return auth_service.user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser, db: DB):
    auth_service.logout_everywhere(db, user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(body: ForgotIn, db: DB, request: Request):
    _limit(request, "forgot", 5)
    auth_service.forgot_password(db, body.email)
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetIn, db: DB, request: Request):
    _limit(request, "reset", 10)
    auth_service.reset_password(db, body.token, body.password)


# ---------------- Google OAuth 2.0 (authorization code flow with state) ----------------
@router.get("/google/login")
def google_login():
    s = get_settings()
    if not s.google_enabled:
        return RedirectResponse(f"{s.FRONTEND_URL.rstrip('/')}/auth?error=google_not_configured")
    state = secrets.token_urlsafe(24)
    url = GOOGLE_AUTH + "?" + urlencode({
        "client_id": s.GOOGLE_CLIENT_ID, "redirect_uri": s.GOOGLE_REDIRECT_URI, "response_type": "code",
        "scope": "openid email profile", "state": state, "prompt": "select_account",
    })
    resp = RedirectResponse(url)
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax", secure=s.is_production, path="/")
    return resp


@router.get("/google/callback")
def google_callback(request: Request, db: DB, code: str | None = None, state: str | None = None, error: str | None = None):
    s = get_settings()
    front = f"{s.FRONTEND_URL.rstrip('/')}/auth"

    def fail(reason: str):
        r = RedirectResponse(f"{front}?error={reason}")
        r.delete_cookie(STATE_COOKIE, path="/")
        return r

    expected = request.cookies.get(STATE_COOKIE)
    if error or not code:
        return fail("google_cancelled")
    if not state or not expected or not secrets.compare_digest(state, expected):
        return fail("google_state")
    try:
        with httpx.Client(timeout=15) as client:
            tok = client.post(GOOGLE_TOKEN, data={
                "code": code, "client_id": s.GOOGLE_CLIENT_ID, "client_secret": s.GOOGLE_CLIENT_SECRET,
                "redirect_uri": s.GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
            })
            tok.raise_for_status()
            info = client.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
            info.raise_for_status()
            profile = info.json()
    except (httpx.HTTPError, KeyError, ValueError):
        return fail("google_failed")
    if not profile.get("sub") or not profile.get("email") or not profile.get("email_verified"):
        return fail("google_unverified")
    try:
        login_code = auth_service.google_user(db, profile["sub"], profile["email"], profile.get("name", ""), profile.get("picture"))
    except HTTPException:
        return fail("account_disabled")
    r = RedirectResponse(f"{front}?code={login_code}")
    r.delete_cookie(STATE_COOKIE, path="/")
    return r


@router.post("/google/exchange", response_model=TokenOut)
def google_exchange(body: CodeIn, db: DB, request: Request):
    _limit(request, "exchange", 20)
    return auth_service.exchange_code(db, body.code)
