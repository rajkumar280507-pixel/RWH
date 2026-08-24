"""Centralized application settings, loaded from environment variables / .env."""
import os
from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RWH-DSS"
    environment: str = "development"
    debug: bool = True

    database_url: str = (
        "mysql+pymysql://rwh:rwh_app_pw@localhost:3306/rwh"
    )

    # Railway's MySQL plugin exposes these discrete variables on the
    # database service, but a backend service only gets them for free if
    # something references them into its own env (e.g. a DATABASE_URL
    # variable set to `${{MySQL.MYSQL_URL}}`). If that reference was never
    # added, DATABASE_URL falls back to the localhost default above and the
    # app crashes trying to reach a MySQL server that doesn't exist in the
    # container. These fields let `_build_database_url_from_parts` below
    # assemble a working URL directly from Railway's own variables instead,
    # so the backend connects correctly either way.
    mysqlhost: str | None = None
    mysqlport: str | None = None
    mysqluser: str | None = None
    mysqlpassword: str | None = None
    mysqldatabase: str | None = None

    @field_validator("database_url")
    @classmethod
    def _use_pymysql_driver(cls, v: str) -> str:
        # Managed MySQL hosts (Railway, etc.) hand out plain mysql:// URLs;
        # SQLAlchemy needs the driver named explicitly.
        if v.startswith("mysql://"):
            return "mysql+pymysql://" + v[len("mysql://") :]
        return v

    @model_validator(mode="after")
    def _build_database_url_from_parts(self) -> "Settings":
        # Only kicks in when DATABASE_URL itself was never set in the
        # environment (local dev's .env always sets it explicitly, so this
        # is a no-op there) and Railway's discrete MySQL variables are
        # present — i.e. exactly the "fresh Railway service, no DATABASE_URL
        # reference wired up yet" situation.
        if "DATABASE_URL" not in os.environ and self.mysqlhost:
            port = self.mysqlport or "3306"
            self.database_url = (
                f"mysql+pymysql://{self.mysqluser}:{self.mysqlpassword}"
                f"@{self.mysqlhost}:{port}/{self.mysqldatabase}"
            )
        return self

    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://rwh-iota.vercel.app",
    ]

    # Public URL of the deployed frontend, used to build the QR-code
    # verification link embedded in generated PDF reports (Phase 7).
    frontend_url: str = "https://rwh-iota.vercel.app"

    # CGWB National Water Informatics Data Portal (NWDP) resources
    cgwb_groundwater_url: str = (
        "https://nwdp.nwic.gov.in/api/3/action/datastore_search"
    )
    cgwb_groundwater_resource_id: str = "6857c02f-c77e-4576-b349-3e45aacc1c21"
    cgwb_rainfall_url: str = "https://nwdp.nwic.gov.in/api/3/action/datastore_search"
    cgwb_rainfall_resource_id: str = "21b02519-f3d3-409d-a091-94332d848a8e"

    sync_page_size: int = 1000
    sync_interval_minutes: int = 60
    sync_max_retries: int = 3
    sync_retry_backoff_seconds: int = 30
    sync_http_timeout_seconds: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
