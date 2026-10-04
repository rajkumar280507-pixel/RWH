"""User accounts: registration, login, and the current-user endpoint.

Real multi-role accounts (civil engineer / municipal employee / builder /
consultant / researcher / office staff) backed by the `users` table —
replaces the previous single hardcoded admin-account milestone.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import create_access_token, get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> User:
    existing = db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    ).scalar_one_or_none()
    if existing is not None:
        field = "username" if existing.username == body.username else "email"
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"That {field} is already registered")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=pwd_context.hash(body.password),
        full_name=body.full_name,
        organization=body.organization,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.execute(select(User).where(User.username == body.username)).scalar_one_or_none()
    if user is None or not user.is_active or not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return TokenResponse(access_token=create_access_token(subject=str(user.id)))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
