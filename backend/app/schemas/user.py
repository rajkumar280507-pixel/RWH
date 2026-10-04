"""Request/response shapes for the auth + user-accounts endpoints."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import USER_ROLES


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    organization: str | None = None
    role: str = "office_staff"

    @field_validator("role")
    @classmethod
    def _valid_role(cls, v: str) -> str:
        # Anyone can self-register as any professional role except "admin" —
        # admin accounts are provisioned directly in the database, never
        # through public registration.
        if v not in USER_ROLES or v == "admin":
            raise ValueError(f"role must be one of {[r for r in USER_ROLES if r != 'admin']}")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None
    organization: str | None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
