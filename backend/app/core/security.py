from datetime import timedelta
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.utils import utcnow

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def _token(sub: str, kind: str, delta: timedelta, role: str, **extra) -> str:
    s = get_settings()
    payload = {"sub": sub, "type": kind, "role": role, "iat": utcnow(), "exp": utcnow() + delta, **extra}
    return jwt.encode(payload, s.JWT_SECRET_KEY, algorithm=s.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str, version: int = 0) -> str:
    return _token(user_id, "access", timedelta(minutes=get_settings().ACCESS_TOKEN_EXPIRE_MINUTES), role, ver=version)


def create_refresh_token(user_id: str, role: str, version: int = 0) -> str:
    return _token(user_id, "refresh", timedelta(days=get_settings().REFRESH_TOKEN_EXPIRE_DAYS), role, ver=version)


def decode_token(token: str, kind: str) -> dict:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.JWT_SECRET_KEY, algorithms=[s.JWT_ALGORITHM], options={"require_exp": True, "require_sub": True})
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if payload.get("type") != kind:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return payload


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
):
    from app.models.user import User

    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(creds.credentials, "access")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active or payload.get("ver", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled")
    return user


def require_admin(user=Depends(get_current_user)):
    from app.models.user import Role

    if user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user
