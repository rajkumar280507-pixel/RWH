"""Pydantic response/request models for the telemetry API."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GwStationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_code: str
    station_name: str | None = None
    state: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class GwReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: int
    station_code: str
    station_name: str | None = None
    state: str | None = None
    district: str | None = None
    taluk: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    # Positive depth below ground; null when the raw feed value isn't a depth.
    water_level_m: float | None = None
    raw_water_level_m: float | None = None
    recorded_at: datetime
    age_hours: int | None = None


class RainfallStationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_code: str
    station_name: str | None = None
    state: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class RainfallReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: int
    station_code: str
    station_name: str | None = None
    state: str | None = None
    district: str | None = None
    taluk: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    rainfall_mm: float | None = None
    recorded_at: datetime
    age_hours: int | None = None


class SyncRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    records_fetched: int
    records_upserted: int
    records_failed: int
    error_message: str | None = None


class DashboardStats(BaseModel):
    gw_station_count: int
    rainfall_station_count: int
    avg_groundwater_level_m: float | None
    avg_rainfall_mm: float | None
    last_gw_sync: datetime | None
    last_rainfall_sync: datetime | None
