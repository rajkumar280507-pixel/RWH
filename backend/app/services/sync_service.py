"""Pulls groundwater / rainfall telemetry from CGWB and UPSERTs it into
MySQL, with pagination, dedup, retry, and full sync_run bookkeeping.

Field-name mapping is defensive: CKAN resources on NWDP are hand-curated by
different state agencies and don't share one exact column schema, so each
record is probed against a list of known aliases. Anything that can't be
mapped to a station code + timestamp is logged to `sync_failures` and
skipped rather than aborting the whole page.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from dateutil import parser as dateparser
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.telemetry import (
    GwReading,
    GwStation,
    RainfallReading,
    RainfallStation,
    SyncFailure,
    SyncRun,
)
from app.services.cgwb_client import CgwbApiError, CgwbClient

logger = logging.getLogger("rwh.sync_service")
settings = get_settings()

STATION_CODE_KEYS = ("stationcode", "station_code", "wellcode", "site_id", "station_id", "wellid")
# NWDP's actual CGWB telemetry resources have no separate station-code column
# at all — "Station" is a name, not a code — so a synthetic code is built
# from district+station in _station_code() below when none of these match.
STATION_NAME_KEYS = ("stationname", "station_name", "sitename", "well_name", "name", "station")
STATE_KEYS = ("state", "statename")
DISTRICT_KEYS = ("district", "districtname")
TALUK_KEYS = ("taluk", "tehsil", "block")
LAT_KEYS = ("latitude", "lat", "y")
LON_KEYS = ("longitude", "lon", "lng", "x")
DATE_KEYS = (
    "date", "recorded_date", "datatime", "observation_date", "reading_date", "timestamp",
    "data acquisition time",
)
GW_VALUE_KEYS = (
    "waterlevel", "water_level", "dataValue", "datavalue", "value", "gwl", "level_m",
    "groundwater level telemetry 6 hourly (meter)",
)
RAIN_VALUE_KEYS = (
    "rainfall", "rainfall_mm", "dataValue", "datavalue", "value", "precip_mm",
    "telemetry hourly rainfall (mm)",
)


def _first(record: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for k in keys:
        if k in record and record[k] not in (None, ""):
            return record[k]
        # CKAN sometimes preserves original casing; try case-insensitive match
        for rk, rv in record.items():
            if rk.lower() == k.lower() and rv not in (None, ""):
                return rv
    return None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return None


def _to_timestamp(value: Any) -> datetime | None:
    """Parses to a naive UTC datetime — MySQL's DATETIME columns aren't
    timezone-aware, so any offset the source data carries is normalized to
    UTC and then stripped rather than handed to the driver as-is. CGWB's
    "Data Acquisition Time" field is DD-MM-YYYY (Indian convention), so
    dayfirst=True avoids misreading e.g. "05-06-2026" as June 5th.
    """
    if value is None:
        return None
    try:
        dt = dateparser.parse(str(value), dayfirst=True)
    except (ValueError, TypeError, OverflowError):
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(tzinfo=None)


def _station_code(record: dict[str, Any]) -> str | None:
    """Real station code if the resource has one; otherwise a synthetic key
    built from district+station name, since NWDP's CGWB telemetry resources
    identify stations by name only, not a stable code column.
    """
    code = _first(record, STATION_CODE_KEYS)
    if code:
        return str(code)
    name = _first(record, STATION_NAME_KEYS)
    if not name:
        return None
    district = _first(record, DISTRICT_KEYS)
    return f"{district}::{name}" if district else str(name)


class SyncService:
    def __init__(
        self,
        db: Session,
        on_progress: Callable[[dict], None] | None = None,
    ):
        self.db = db
        self.on_progress = on_progress

    # ------------------------------------------------------------------
    # Groundwater
    # ------------------------------------------------------------------
    def sync_groundwater(self) -> SyncRun:
        client = CgwbClient(settings.cgwb_groundwater_url, settings.cgwb_groundwater_resource_id)
        return self._run_sync("groundwater", client, self._upsert_gw_record)

    # ------------------------------------------------------------------
    # Rainfall
    # ------------------------------------------------------------------
    def sync_rainfall(self) -> SyncRun:
        client = CgwbClient(settings.cgwb_rainfall_url, settings.cgwb_rainfall_resource_id)
        return self._run_sync("rainfall", client, self._upsert_rainfall_record)

    # ------------------------------------------------------------------
    # Shared driver: pagination + transaction + bookkeeping + retry
    # ------------------------------------------------------------------
    def _run_sync(self, source: str, client: CgwbClient, upsert_fn: Callable[[dict], bool]) -> SyncRun:
        run = SyncRun(source=source, status="running")
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)

        fetched = upserted = failed = 0
        try:
            for offset, records, total in client.iter_all_records():
                for record in records:
                    fetched += 1
                    try:
                        with self.db.begin_nested():
                            ok = upsert_fn(record)
                        if ok:
                            upserted += 1
                        else:
                            failed += 1
                            self._log_failure(run.id, source, record, "unmappable record (no station code / timestamp)")
                    except Exception as exc:  # noqa: BLE001 - one bad row must not kill the page
                        failed += 1
                        self.db.rollback()
                        self._log_failure(run.id, source, record, str(exc))

                run.last_offset = offset + len(records)
                run.records_fetched = fetched
                run.records_upserted = upserted
                run.records_failed = failed
                self.db.commit()

                if self.on_progress:
                    self.on_progress(
                        {
                            "source": source,
                            "offset": run.last_offset,
                            "total": total,
                            "fetched": fetched,
                            "upserted": upserted,
                            "failed": failed,
                        }
                    )

            run.status = "success" if failed == 0 else "partial"
        except CgwbApiError as exc:
            run.status = "failed"
            run.error_message = str(exc)
            logger.exception("CGWB API error during %s sync", source)
        except Exception as exc:  # noqa: BLE001
            run.status = "failed"
            run.error_message = str(exc)
            logger.exception("Unexpected error during %s sync", source)
        finally:
            run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            run.records_fetched = fetched
            run.records_upserted = upserted
            run.records_failed = failed
            self.db.commit()

        return run

    def _log_failure(self, sync_run_id: int, source: str, record: dict, error: str) -> None:
        self.db.add(SyncFailure(sync_run_id=sync_run_id, source=source, raw_record=record, error=error))
        self.db.commit()

    # ------------------------------------------------------------------
    # Record mappers
    # ------------------------------------------------------------------
    def _upsert_gw_station(self, record: dict) -> GwStation | None:
        code = _station_code(record)
        if not code:
            return None
        station = self.db.query(GwStation).filter_by(station_code=code).one_or_none()
        lat = _to_float(_first(record, LAT_KEYS))
        lon = _to_float(_first(record, LON_KEYS))
        if station is None:
            station = GwStation(
                station_code=code,
                station_name=_first(record, STATION_NAME_KEYS),
                state=_first(record, STATE_KEYS),
                district=_first(record, DISTRICT_KEYS),
                taluk=_first(record, TALUK_KEYS),
                latitude=lat,
                longitude=lon,
            )
            self.db.add(station)
            self.db.flush()
        else:
            if lat is not None:
                station.latitude = lat
            if lon is not None:
                station.longitude = lon
        return station

    def _upsert_gw_record(self, record: dict) -> bool:
        recorded_at = _to_timestamp(_first(record, DATE_KEYS))
        if recorded_at is None:
            return False
        station = self._upsert_gw_station(record)
        if station is None:
            return False

        water_level = _to_float(_first(record, GW_VALUE_KEYS))
        existing = (
            self.db.query(GwReading)
            .filter_by(station_id=station.id, recorded_at=recorded_at)
            .one_or_none()
        )
        if existing:
            existing.water_level_m = water_level
            existing.source_payload = record
        else:
            self.db.add(
                GwReading(
                    station_id=station.id,
                    external_id=str(record.get("_id", "")) or None,
                    recorded_at=recorded_at,
                    water_level_m=water_level,
                    data_value=str(_first(record, GW_VALUE_KEYS)) if _first(record, GW_VALUE_KEYS) is not None else None,
                    source_payload=record,
                )
            )
        return True

    def _upsert_rainfall_station(self, record: dict) -> RainfallStation | None:
        code = _station_code(record)
        if not code:
            return None
        station = self.db.query(RainfallStation).filter_by(station_code=code).one_or_none()
        lat = _to_float(_first(record, LAT_KEYS))
        lon = _to_float(_first(record, LON_KEYS))
        if station is None:
            station = RainfallStation(
                station_code=code,
                station_name=_first(record, STATION_NAME_KEYS),
                state=_first(record, STATE_KEYS),
                district=_first(record, DISTRICT_KEYS),
                taluk=_first(record, TALUK_KEYS),
                latitude=lat,
                longitude=lon,
            )
            self.db.add(station)
            self.db.flush()
        else:
            if lat is not None:
                station.latitude = lat
            if lon is not None:
                station.longitude = lon
        return station

    def _upsert_rainfall_record(self, record: dict) -> bool:
        recorded_at = _to_timestamp(_first(record, DATE_KEYS))
        if recorded_at is None:
            return False
        station = self._upsert_rainfall_station(record)
        if station is None:
            return False

        rainfall_mm = _to_float(_first(record, RAIN_VALUE_KEYS))
        existing = (
            self.db.query(RainfallReading)
            .filter_by(station_id=station.id, recorded_at=recorded_at)
            .one_or_none()
        )
        if existing:
            existing.rainfall_mm = rainfall_mm
            existing.source_payload = record
        else:
            self.db.add(
                RainfallReading(
                    station_id=station.id,
                    external_id=str(record.get("_id", "")) or None,
                    recorded_at=recorded_at,
                    rainfall_mm=rainfall_mm,
                    data_value=str(_first(record, RAIN_VALUE_KEYS)) if _first(record, RAIN_VALUE_KEYS) is not None else None,
                    source_payload=record,
                )
            )
        return True
