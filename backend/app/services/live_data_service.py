"""Connects the RWH design engine to the live, hourly-synced CGWB telemetry
instead of requiring the operator to type in a groundwater depth or annual
rainfall figure by hand.

Given a rooftop's centroid, this finds the nearest groundwater station with
a recent reading (`gw_stations` / `gw_readings`, populated by the hourly
sync in `app/scheduler/jobs.py`) and the nearest rainfall station, then
rolls the latter's last-365-days of readings into an annual total. Both
lookups use the Haversine great-circle formula computed in SQL (MySQL has no
PostGIS/spatial KNN index here, so this is a full scan ordered by computed
distance — fine at the station-count scale CGWB actually has; revisit with a
bounding-box pre-filter or a spatial index if that changes).

If a value is close enough in space but the *data* is thin (station just
started reporting, or a mid-sync gap), the rainfall total is pro-rated from
whatever coverage exists and flagged via `days_covered` / a caller-visible
warning rather than silently pretending it's a full year.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

# Beyond this, "nearest station" stops being a meaningful proxy for the
# building's local hydrogeology/rainfall and the caller should fall back to
# a manually entered value instead.
MAX_STATION_DISTANCE_KM = 75.0
MIN_RAINFALL_DAYS_COVERED = 30

EARTH_RADIUS_KM = 6371.0

# --- Groundwater value normalization -----------------------------------
# The NWDP "Groundwater Level Telemetry 6 Hourly (meter)" column is NOT a
# single consistent quantity. Inspecting the live feed shows:
#   * ~455k readings in -100..0  -> depth below ground, negative convention
#   * ~18k  readings in 0..100   -> depth below ground, positive convention
#   * ~1k   readings outside that (up to 25,851) -> reduced levels above MSL,
#     or plain bad values; either way they are not a depth we can use.
#
# The design engine needs a POSITIVE depth-below-ground: it compares against
# the 3 m minimum separation from the water table and the 8 m injection-bore
# trigger. Feeding a raw negative through those comparisons silently inverts
# both rules (a healthy 12 m deep table reads as "shallow"), so every value
# is normalized here and anything outside a physically plausible depth range
# is rejected rather than guessed at.
MAX_PLAUSIBLE_DEPTH_M = 100.0


def normalize_groundwater_depth(raw_value: float | None) -> float | None:
    """Converts a raw CGWB level reading to a positive depth below ground.

    Returns None when the value cannot be interpreted as a depth (reduced
    level above MSL, sentinel, or corrupt), so callers fall back to manual
    entry instead of designing against a nonsense number.
    """
    if raw_value is None:
        return None
    value = float(raw_value)
    depth = abs(value) if value < 0 else value
    if depth <= 0 or depth > MAX_PLAUSIBLE_DEPTH_M:
        return None
    return round(depth, 3)

# Haversine distance in km between (lat, lon) and each row's (latitude,
# longitude), expressed in raw SQL so it can be used in ORDER BY / WHERE.
_HAVERSINE_KM_EXPR = f"""
    ({EARTH_RADIUS_KM} * ACOS(LEAST(1.0, GREATEST(-1.0,
        COS(RADIANS(:lat)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(:lon))
        + SIN(RADIANS(:lat)) * SIN(RADIANS(latitude))
    ))))
"""


@dataclass
class LiveGroundwaterReading:
    station_id: int
    station_code: str
    station_name: str | None
    distance_km: float
    water_level_m: float  # positive depth below ground, normalized
    raw_value: float      # exactly what CGWB reported, for audit
    recorded_at: str


@dataclass
class LiveRainfallEstimate:
    station_id: int
    station_code: str
    station_name: str | None
    distance_km: float
    annual_rainfall_mm: float
    days_covered: int
    extrapolated: bool


def get_nearest_groundwater_reading(db: Session, lon: float, lat: float) -> LiveGroundwaterReading | None:
    # Candidates rather than a single row: the closest station may report a
    # value that isn't a usable depth (see normalize_groundwater_depth), in
    # which case we fall through to the next nearest usable one instead of
    # returning nothing.
    rows = db.execute(
        text(
            f"""
            SELECT station_id, station_code, station_name, water_level_m,
                   raw_water_level_m, recorded_at,
                   {_HAVERSINE_KM_EXPR} AS distance_km
            FROM v_gw_latest
            WHERE water_level_m IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY distance_km ASC
            LIMIT 25
            """
        ),
        {"lon": lon, "lat": lat},
    ).mappings().all()

    for row in rows:
        if row["distance_km"] is None or row["distance_km"] > MAX_STATION_DISTANCE_KM:
            break  # ordered by distance, so everything after is further still
        depth = normalize_groundwater_depth(row["water_level_m"])
        if depth is None:
            continue
        return LiveGroundwaterReading(
            station_id=row["station_id"],
            station_code=row["station_code"],
            station_name=row["station_name"],
            distance_km=round(float(row["distance_km"]), 2),
            water_level_m=depth,
            raw_value=float(row["raw_water_level_m"]),
            recorded_at=row["recorded_at"].isoformat(),
        )

    return None


def get_live_annual_rainfall(db: Session, lon: float, lat: float) -> LiveRainfallEstimate | None:
    station = db.execute(
        text(
            f"""
            SELECT id, station_code, station_name,
                   {_HAVERSINE_KM_EXPR} AS distance_km
            FROM rainfall_stations
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY distance_km ASC
            LIMIT 1
            """
        ),
        {"lon": lon, "lat": lat},
    ).mappings().one_or_none()

    if station is None or station["distance_km"] is None or station["distance_km"] > MAX_STATION_DISTANCE_KM:
        return None

    agg = db.execute(
        text(
            """
            SELECT COALESCE(SUM(rainfall_mm), 0) AS total_mm,
                   COUNT(DISTINCT DATE(recorded_at)) AS days_covered
            FROM rainfall_readings
            WHERE station_id = :station_id AND recorded_at > (NOW() - INTERVAL 365 DAY)
            """
        ),
        {"station_id": station["id"]},
    ).mappings().one()

    days_covered = int(agg["days_covered"])
    if days_covered < MIN_RAINFALL_DAYS_COVERED:
        return None  # too little data to extrapolate responsibly

    total_mm = float(agg["total_mm"])
    extrapolated = days_covered < 365
    annual_estimate = round(total_mm * (365.0 / days_covered), 1) if extrapolated else round(total_mm, 1)

    return LiveRainfallEstimate(
        station_id=station["id"],
        station_code=station["station_code"],
        station_name=station["station_name"],
        distance_km=round(float(station["distance_km"]), 2),
        annual_rainfall_mm=annual_estimate,
        days_covered=days_covered,
        extrapolated=extrapolated,
    )
