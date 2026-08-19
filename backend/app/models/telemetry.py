"""ORM models for the telemetry + sync-bookkeeping tables in database/schema.sql,
database/groundwater.sql and database/rainfall.sql (MySQL).
"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    records_fetched: Mapped[int] = mapped_column(Integer, default=0)
    records_upserted: Mapped[int] = mapped_column(Integer, default=0)
    records_failed: Mapped[int] = mapped_column(Integer, default=0)
    last_offset: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)


class SyncFailure(Base):
    __tablename__ = "sync_failures"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sync_run_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sync_runs.id"))
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_record: Mapped[dict] = mapped_column(JSON, nullable=False)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)


class GwStation(Base):
    __tablename__ = "gw_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    station_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    taluk: Mapped[str | None] = mapped_column(String(120), nullable=True)
    block: Mapped[str | None] = mapped_column(String(120), nullable=True)
    agency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    well_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    readings: Mapped[list["GwReading"]] = relationship(back_populates="station")


class GwReading(Base):
    __tablename__ = "gw_readings"
    __table_args__ = (UniqueConstraint("station_id", "recorded_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    station_id: Mapped[int] = mapped_column(Integer, ForeignKey("gw_stations.id"))
    external_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    water_level_m: Mapped[float | None] = mapped_column(Numeric(8, 3), nullable=True)
    data_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    sync_run_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sync_runs.id"), nullable=True)

    station: Mapped["GwStation"] = relationship(back_populates="readings")


class RainfallStation(Base):
    __tablename__ = "rainfall_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    station_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    taluk: Mapped[str | None] = mapped_column(String(120), nullable=True)
    agency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    readings: Mapped[list["RainfallReading"]] = relationship(back_populates="station")


class RainfallReading(Base):
    __tablename__ = "rainfall_readings"
    __table_args__ = (UniqueConstraint("station_id", "recorded_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    station_id: Mapped[int] = mapped_column(Integer, ForeignKey("rainfall_stations.id"))
    external_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    rainfall_mm: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    data_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    sync_run_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sync_runs.id"), nullable=True)

    station: Mapped["RainfallStation"] = relationship(back_populates="readings")
