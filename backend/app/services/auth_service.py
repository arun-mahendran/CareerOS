import hashlib
import logging
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.models import ConnectedAccount, Notification, OAuthLoginCode, PasswordResetToken, Profile, Role, Subscription, User
from app.utils import utcnow

log = logging.getLogger("careeros.auth")


def _sha(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()


def user_out(user: User) -> dict:
    p = user.profile
    return {
        "id": user.id, "email": user.email, "role": user.role.value,
        "full_name": p.full_name if p else None, "avatar_url": p.avatar_url if p else None,
        "target_role": p.target_role if p else None,
    }


def issue_tokens(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.role.value, user.token_version),
        "refresh_token": create_refresh_token(user.id, user.role.value, user.token_version),
        "token_type": "bearer",
        "expires_in": get_settings().ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_out(user),
    }


def _new_candidate(db: Session, email: str, name: str, password_hash: str, avatar: str | None = None) -> User:
    # Public registration and Google sign-in can ONLY create candidates. Admins are seeded.
    user = User(email=email, password_hash=password_hash, role=Role.CANDIDATE)
    user.profile = Profile(full_name=name.strip()[:160], avatar_url=avatar)
    db.add(user)
    db.flush()
    db.add(Subscription(user_id=user.id))
    db.add(Notification(user_id=user.id, type="SYSTEM", title="Welcome to CareerOS",
                        body="Set your target role to personalize your journey.", link="/profile"))
    return user


def register(db: Session, name: str, email: str, password: str) -> dict:
    email = email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = _new_candidate(db, email, name, hash_password(password))
    db.commit()
    db.refresh(user)
    return issue_tokens(user)


def login(db: Session, email: str, password: str) -> dict:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled")
    return issue_tokens(user)


def refresh(db: Session, token: str) -> dict:
    payload = decode_token(token, "refresh")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active or payload.get("ver", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    return issue_tokens(user)


def logout_everywhere(db: Session, user: User) -> None:
    user.token_version += 1  # invalidates outstanding access and refresh tokens
    db.commit()


# ---------------- Google ----------------
def google_user(db: Session, sub: str, email: str, name: str, picture: str | None) -> str:
    """Find or create the account for a verified Google identity; returns a one-time login code."""
    email = email.lower().strip()
    link = db.scalar(select(ConnectedAccount).where(ConnectedAccount.provider == "google", ConnectedAccount.external_id == sub))
    user = db.get(User, link.user_id) if link else db.scalar(select(User).where(User.email == email))
    if not user:
        # Unusable random password: Google users sign in with Google (or set one via "Forgot password").
        user = _new_candidate(db, email, name or email.split("@")[0], hash_password(secrets.token_urlsafe(32)), picture)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled")
    if not link:
        db.add(ConnectedAccount(user_id=user.id, provider="google", external_id=sub, connected_at=utcnow()))
    if picture and user.profile and not user.profile.avatar_url:
        user.profile.avatar_url = picture
    code = secrets.token_urlsafe(32)
    db.add(OAuthLoginCode(code_hash=_sha(code), user_id=user.id, expires_at=utcnow() + timedelta(minutes=2)))
    db.commit()
    return code


def exchange_code(db: Session, code: str) -> dict:
    row = db.get(OAuthLoginCode, _sha(code))
    if not row or row.used_at or row.expires_at < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This sign-in link has expired. Please try again.")
    row.used_at = utcnow()
    db.commit()
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled")
    return issue_tokens(user)


# ---------------- Password reset ----------------
def _send_email(to: str, subject: str, body: str) -> bool:
    s = get_settings()
    if not s.SMTP_HOST:
        return False
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.SMTP_FROM or s.SMTP_USER, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if s.SMTP_USER:
                smtp.login(s.SMTP_USER, s.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("Password reset email failed")
        return False


def forgot_password(db: Session, email: str) -> None:
    """Always answers the same way so account existence isn't revealed."""
    s = get_settings()
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if not user or not user.is_active:
        return
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(user_id=user.id, token_hash=_sha(token),
                              expires_at=utcnow() + timedelta(minutes=s.PASSWORD_RESET_EXPIRE_MINUTES)))
    db.commit()
    link = f"{s.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    sent = _send_email(user.email, "Reset your CareerOS password",
                       f"Use this link within {s.PASSWORD_RESET_EXPIRE_MINUTES} minutes to set a new password:\n\n{link}\n\n"
                       "If you didn't ask for this, ignore this email.")
    if not sent:
        if s.is_production:
            log.error("Password reset requested but SMTP is not configured or failed; no email was sent")
        else:  # local development only: the link is printed to the server console
            log.warning("SMTP not configured. Development reset link for %s: %s", user.email, link)


def reset_password(db: Session, token: str, password: str) -> None:
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == _sha(token)))
    if not row or row.used_at or row.expires_at < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")
    user = db.get(User, row.user_id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")
    user.password_hash = hash_password(password)
    user.token_version += 1
    row.used_at = utcnow()
    db.commit()
