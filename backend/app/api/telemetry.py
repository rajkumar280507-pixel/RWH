"""Read endpoints over the synced groundwater / rainfall telemetry, backing
the GIS map layers and dashboard stat cards.

Every list endpoint returns the *latest* reading per station (never the raw
historical rows) and supports state/district/freshness filtering, because the
CGWB feed carries 600k+ historical readings across hundreds of stations and
the map only ever wants the current picture.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.telemetry import GwReadingOut, RainfallReadingOut

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

# `max_age_days` filters on reading freshness: a station whose last reading is
# months old is still "latest" for that station but shouldn't be presented as
# current telemetry without the operator opting in.
_GW_LATEST_SQL = text(
    """
    SELECT station_id, station_code, station_name, state, district, taluk,
           latitude, longitude, water_level_m, raw_water_level_m, recorded_at,
           TIMESTAMPDIFF(HOUR, recorded_at, NOW()) AS age_hours
    FROM v_gw_latest
    WHERE (:district IS NULL OR LOWER(TRIM(district)) = LOWER(TRIM(:district)))
      AND (:state IS NULL OR LOWER(TRIM(state)) = LOWER(TRIM(:state)))
      AND (:taluk IS NULL OR LOWER(TRIM(taluk)) = LOWER(TRIM(:taluk)))
      AND (:max_age_days IS NULL OR recorded_at > (NOW() - INTERVAL :max_age_days DAY))
      AND (:search IS NULL OR LOWER(station_name) LIKE LOWER(CONCAT('%', :search, '%')))
    ORDER BY recorded_at DESC
    LIMIT :limit
    """
)

_RAINFALL_LATEST_SQL = text(
    """
    SELECT station_id, station_code, station_name, state, district, taluk,
           latitude, longitude, rainfall_mm, recorded_at,
           TIMESTAMPDIFF(HOUR, recorded_at, NOW()) AS age_hours
    FROM v_rainfall_latest
    WHERE (:district IS NULL OR LOWER(TRIM(district)) = LOWER(TRIM(:district)))
      AND (:state IS NULL OR LOWER(TRIM(state)) = LOWER(TRIM(:state)))
      AND (:taluk IS NULL OR LOWER(TRIM(taluk)) = LOWER(TRIM(:taluk)))
      AND (:max_age_days IS NULL OR recorded_at > (NOW() - INTERVAL :max_age_days DAY))
      AND (:search IS NULL OR LOWER(station_name) LIKE LOWER(CONCAT('%', :search, '%')))
    ORDER BY recorded_at DESC
    LIMIT :limit
    """
)


@router.get("/groundwater/latest", response_model=list[GwReadingOut])
def latest_groundwater(
    district: str | None = Query(default=None),
    state: str | None = Query(default=None),
    taluk: str | None = Query(default=None),
    max_age_days: int | None = Query(default=None, ge=1, le=3650),
    search: str | None = Query(default=None),
    limit: int = Query(default=1000, le=5000),
    db: Session = Depends(get_db),
):
    clean_district = district.strip() if district else None
    clean_state = state.strip() if state else None
    clean_taluk = taluk.strip() if taluk else None
    clean_search = search.strip() if search else None

    # Step 1: Exact search with taluk & max_age_days
    rows = db.execute(
        _GW_LATEST_SQL,
        {
            "district": clean_district,
            "state": clean_state,
            "taluk": clean_taluk,
            "max_age_days": max_age_days,
            "search": clean_search,
            "limit": limit,
        },
    ).mappings().all()

    # Step 2: Fallback to district level if taluk has 0 stations
    if not rows and clean_taluk and clean_district:
        rows = db.execute(
            _GW_LATEST_SQL,
            {
                "district": clean_district,
                "state": clean_state,
                "taluk": None,
                "max_age_days": max_age_days,
                "search": clean_search,
                "limit": limit,
            },
        ).mappings().all()

    # Step 3: Fallback without max_age_days date cutoff if still 0 rows
    if not rows and max_age_days is not None:
        rows = db.execute(
            _GW_LATEST_SQL,
            {
                "district": clean_district,
                "state": clean_state,
                "taluk": clean_taluk,
                "max_age_days": None,
                "search": clean_search,
                "limit": limit,
            },
        ).mappings().all()

    return [GwReadingOut.model_validate(row) for row in rows]


@router.get("/rainfall/latest", response_model=list[RainfallReadingOut])
def latest_rainfall(
    district: str | None = Query(default=None),
    state: str | None = Query(default=None),
    taluk: str | None = Query(default=None),
    max_age_days: int | None = Query(default=None, ge=1, le=3650),
    search: str | None = Query(default=None),
    limit: int = Query(default=1000, le=5000),
    db: Session = Depends(get_db),
):
    clean_district = district.strip() if district else None
    clean_state = state.strip() if state else None
    clean_taluk = taluk.strip() if taluk else None
    clean_search = search.strip() if search else None

    # Step 1: Exact search with taluk & max_age_days
    rows = db.execute(
        _RAINFALL_LATEST_SQL,
        {
            "district": clean_district,
            "state": clean_state,
            "taluk": clean_taluk,
            "max_age_days": max_age_days,
            "search": clean_search,
            "limit": limit,
        },
    ).mappings().all()

    # Step 2: Fallback to district level if micro-taluk has 0 dedicated rainfall stations
    if not rows and clean_taluk and clean_district:
        rows = db.execute(
            _RAINFALL_LATEST_SQL,
            {
                "district": clean_district,
                "state": clean_state,
                "taluk": None,
                "max_age_days": max_age_days,
                "search": clean_search,
                "limit": limit,
            },
        ).mappings().all()

    # Step 3: Fallback without max_age_days date cutoff if still 0 rows
    if not rows and max_age_days is not None:
        rows = db.execute(
            _RAINFALL_LATEST_SQL,
            {
                "district": clean_district,
                "state": clean_state,
                "taluk": clean_taluk,
                "max_age_days": None,
                "search": clean_search,
                "limit": limit,
            },
        ).mappings().all()

    return [RainfallReadingOut.model_validate(row) for row in rows]


@router.get("/filter-options")
def filter_options(db: Session = Depends(get_db)):
    """Distinct state / district / taluk values actually present in the synced
    data, so the UI dropdowns only ever offer values that will return rows.
    Taluks are nested per district because the same taluk name recurs across
    districts and a flat list would be ambiguous.
    """
    # Table name is a hardcoded literal here, never user input.
    def distinct_places(table: str):
        return db.execute(
            text(
                f"SELECT DISTINCT state, district, taluk FROM {table} "
                "WHERE district IS NOT NULL AND district <> '-'"
            )
        ).mappings().all()

    rows = list(distinct_places("gw_stations")) + list(distinct_places("rainfall_stations"))

    districts_by_state: dict[str, set[str]] = {}
    taluks_by_district: dict[str, set[str]] = {}
    for row in rows:
        state = row["state"] or "Unknown"
        district = row["district"]
        districts_by_state.setdefault(state, set()).add(district)
        taluk = row["taluk"]
        # '-' is NWDP's placeholder for "not recorded"; don't offer it as a choice.
        if taluk and taluk != "-":
            taluks_by_district.setdefault(district, set()).add(taluk)

    return {
        "states": sorted(districts_by_state.keys()),
        "districts_by_state": {k: sorted(v) for k, v in sorted(districts_by_state.items())},
        "all_districts": sorted({d for ds in districts_by_state.values() for d in ds}),
        "taluks_by_district": {k: sorted(v) for k, v in sorted(taluks_by_district.items())},
        "all_taluks": sorted({t for ts in taluks_by_district.values() for t in ts}),
    }


@router.get("/groundwater/{station_id}/history")
def groundwater_history(station_id: int, days: int = Query(default=90, le=3650), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT recorded_at, water_level_m
            FROM gw_readings
            WHERE station_id = :station_id AND recorded_at > (NOW() - INTERVAL :days DAY)
            ORDER BY recorded_at ASC
            """
        ),
        {"station_id": station_id, "days": days},
    ).mappings().all()
    return list(rows)


@router.get("/rainfall/{station_id}/history")
def rainfall_history(station_id: int, days: int = Query(default=90, le=3650), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT recorded_at, rainfall_mm
            FROM rainfall_readings
            WHERE station_id = :station_id AND recorded_at > (NOW() - INTERVAL :days DAY)
            ORDER BY recorded_at ASC
            """
        ),
        {"station_id": station_id, "days": days},
    ).mappings().all()
    return list(rows)
