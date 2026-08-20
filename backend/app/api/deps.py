"""Shared FastAPI dependencies: DB session + JWT auth."""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.database.session import get_db

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> str:
    """Returns the username embedded in the JWT. Auth is intentionally
    permissive in this milestone (no user table yet) — any validly signed
    token is accepted; wire to a real users table when the auth module lands.
    """
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username = payload.get("sub")
        if not username:
            raise ValueError("missing sub claim")
        return username
    except (JWTError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


DbSession = Session
