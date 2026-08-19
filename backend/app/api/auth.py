"""Minimal JWT login endpoint. Single operator account from environment
variables for this milestone — replace with a real `users` table + roles
(CGWB / state dept / municipal / consultant / researcher) once the auth
module is built out.
"""
import os

from fastapi import APIRouter, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel

from app.api.deps import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_ADMIN_USER = os.getenv("RWH_ADMIN_USERNAME", "admin")
_ADMIN_HASH = os.getenv("RWH_ADMIN_PASSWORD_HASH") or pwd_context.hash(
    os.getenv("RWH_ADMIN_PASSWORD", "change-me")
)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    if body.username != _ADMIN_USER or not pwd_context.verify(body.password, _ADMIN_HASH):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(subject=body.username))
