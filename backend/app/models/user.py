"""ORM model for database/users.sql — accounts for the multi-role public
application (civil engineers, municipal water dept staff, builders,
consultants, researchers, office staff).
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base

# Kept as a plain tuple (not a DB enum) matching this schema's existing
# convention of CHECK constraints over VARCHAR rather than native ENUM
# columns (see rwh_designs.structure_type/status in recharge.sql).
USER_ROLES = (
    "civil_engineer",
    "municipal_employee",
    "builder",
    "consultant",
    "researcher",
    "office_staff",
    "admin",
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    organization: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="office_staff")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
