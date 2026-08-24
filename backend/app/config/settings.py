"""Centralized application settings, loaded from environment variables / .env."""
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RWH-DSS"
    environment: str = "development"
    debug: bool = True

    database_url: str = (
        "mysql+pymysql://rwh:rwh_app_pw@localhost:3306/rwh"
    )

    @field_validator("database_url")
    @classmethod
    def _use_pymysql_driver(cls, v: str) -> str:
        # Managed MySQL hosts (Railway, etc.) hand out plain mysql:// URLs;
        # SQLAlchemy needs the driver named explicitly.
        if v.startswith("mysql://"):
            return "mysql+pymysql://" + v[len("mysql://") :]
        return v

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
