"""Groundwater trend analysis over the real synced CGWB time series.

This is deliberately ordinary least-squares linear regression on each
station's own observed history — not a black-box ML model. The CGWB
telemetry we sync gives a level series per station; a fitted slope in
metres/year plus its R² and sample size is a defensible, auditable answer
to "is this station declining, and how confident can we be?".

Every result carries `sample_size`, `days_span` and `r_squared` so a thin or
noisy series is visible as such rather than being presented with false
precision. Stations below MIN_READINGS / MIN_DAYS_SPAN are excluded outright
rather than fitted to noise.

Note on units: readings are normalized to a POSITIVE depth below ground
(see live_data_service.normalize_groundwater_depth) before fitting, because
the raw CGWB column mixes sign conventions and contains reduced levels and
sentinels. A rising depth therefore means a FALLING water table; the
returned `trend` label is expressed in plain language ("falling"/"rising")
so the UI never has to reason about the sign itself.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.live_data_service import normalize_groundwater_depth

MIN_READINGS = 12
MIN_DAYS_SPAN = 60
# A station must retain this fraction of its readings after depth
# normalization to be trusted — if most of its values aren't interpretable
# as depths, the station is reporting something else entirely (reduced
# levels above MSL) and fitting a trend to the survivors would be misleading.
MIN_USABLE_FRACTION = 0.8
# Below this |slope| the series is treated as flat rather than trending —
# sub-centimetre-per-year movement is well inside measurement noise for
# telemetry piezometers.
FLAT_THRESHOLD_M_PER_YEAR = 0.05


@dataclass
class StationTrend:
    station_id: int
    station_code: str
    station_name: str | None
    district: str | None
    latitude: float | None
    longitude: float | None
    sample_size: int
    days_span: int
    first_recorded_at: str
    last_recorded_at: str
    latest_level_m: float
    mean_level_m: float
    slope_m_per_year: float
    r_squared: float
    trend: str
    projected_level_1y_m: float
    confidence: str
    caveat: str | None


def _ols(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """Returns (slope, intercept, r_squared) for a simple linear fit."""
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    if sxx == 0:
        return 0.0, mean_y, 0.0
    slope = sxy / sxx
    intercept = mean_y - slope * mean_x
    syy = sum((y - mean_y) ** 2 for y in ys)
    r_squared = (sxy**2 / (sxx * syy)) if syy > 0 else 0.0
    return slope, intercept, r_squared


# A linear fit over less than a full year does not measure a long-term trend —
# it measures where you happen to sit on the seasonal cycle. Extrapolating a
# post-monsoon recession to m/yr produces absurd figures (tens of metres per
# year), so sub-annual series are never allowed above "low" confidence and
# always carry the seasonal caveat.
FULL_SEASONAL_CYCLE_DAYS = 365
# Beyond this, a reported slope is physically implausible for a real aquifer
# trend and is almost certainly a seasonal or data artefact.
IMPLAUSIBLE_SLOPE_M_PER_YEAR = 5.0


def _confidence(
    r_squared: float, sample_size: int, days_span: int, slope_per_year: float
) -> tuple[str, str | None]:
    if sample_size < 30 or days_span < 90:
        return "low", (
            f"Only {sample_size} readings spanning {days_span} days — far too short to "
            "say anything about trend. Treat as indicative only."
        )

    if days_span < FULL_SEASONAL_CYCLE_DAYS:
        return "low", (
            f"Series spans {days_span} days — less than one full seasonal cycle. This slope "
            "measures the current monsoon/recession phase, NOT a long-term trend, and the "
            "m/yr figure is an extrapolation that will overstate real aquifer change. "
            "A full year of telemetry is needed before this can be read as a trend."
        )

    if abs(slope_per_year) > IMPLAUSIBLE_SLOPE_M_PER_YEAR:
        return "low", (
            f"Fitted slope of {slope_per_year:+.1f} m/yr is outside the physically plausible "
            "range for an aquifer trend — likely a seasonal artefact, a station datum change, "
            "or bad values in the feed. Investigate the raw series before using this."
        )

    if r_squared < 0.25:
        return "low", (
            f"Fit explains just {r_squared:.0%} of the variation; the series is dominated "
            "by seasonal/noise effects rather than a clean linear trend."
        )
    if r_squared < 0.5:
        return "moderate", (
            f"Fit explains {r_squared:.0%} of the variation — a trend is present but "
            "seasonal cycles contribute substantially."
        )
    return "high", None


_READINGS_SQL = text(
    """
    SELECT recorded_at, water_level_m
    FROM gw_readings
    WHERE station_id = :sid AND water_level_m IS NOT NULL
    ORDER BY recorded_at ASC
    """
)

_STATION_COLUMNS = "s.id, s.station_code, s.station_name, s.district, s.latitude, s.longitude"


def _fit(db: Session, station) -> StationTrend | None:
    """Fits one station's series. Returns None when the series is too thin to
    say anything honest about.
    """
    raw_rows = db.execute(_READINGS_SQL, {"sid": station["id"]}).mappings().all()
    if len(raw_rows) < MIN_READINGS:
        return None

    # Normalize to positive depth below ground and drop values that aren't
    # depths at all, so the fit isn't dragged by reduced levels or sentinels.
    points = [
        (r["recorded_at"], normalize_groundwater_depth(r["water_level_m"]))
        for r in raw_rows
    ]
    points = [(ts, v) for ts, v in points if v is not None]
    if len(points) < MIN_READINGS or len(points) / len(raw_rows) < MIN_USABLE_FRACTION:
        return None

    first_dt = points[0][0]
    last_dt = points[-1][0]
    days_span = (last_dt - first_dt).days
    if days_span < MIN_DAYS_SPAN:
        return None

    xs = [(ts - first_dt).total_seconds() / 86400.0 for ts, _ in points]
    ys = [v for _, v in points]

    slope_per_day, _intercept, r_squared = _ols(xs, ys)
    slope_per_year = slope_per_day * 365.25
    latest_level = ys[-1]

    # ys are positive depths below ground, so an INCREASING series means the
    # water table is getting deeper i.e. falling.
    if abs(slope_per_year) < FLAT_THRESHOLD_M_PER_YEAR:
        trend = "stable"
    elif slope_per_year > 0:
        trend = "falling"
    else:
        trend = "rising"

    confidence, caveat = _confidence(r_squared, len(points), days_span, slope_per_year)

    return StationTrend(
        station_id=station["id"],
        station_code=station["station_code"],
        station_name=station["station_name"],
        district=station["district"],
        latitude=float(station["latitude"]) if station["latitude"] is not None else None,
        longitude=float(station["longitude"]) if station["longitude"] is not None else None,
        sample_size=len(points),
        days_span=days_span,
        first_recorded_at=first_dt.isoformat(),
        last_recorded_at=last_dt.isoformat(),
        latest_level_m=round(latest_level, 3),
        mean_level_m=round(sum(ys) / len(ys), 3),
        slope_m_per_year=round(slope_per_year, 4),
        r_squared=round(r_squared, 4),
        trend=trend,
        projected_level_1y_m=round(latest_level + slope_per_year, 3),
        confidence=confidence,
        caveat=caveat,
    )


def compute_station_trends(
    db: Session,
    *,
    district: str | None = None,
    limit: int = 200,
) -> list[StationTrend]:
    stations = db.execute(
        text(
            f"""
            SELECT {_STATION_COLUMNS}
            FROM gw_stations s
            WHERE (:district IS NULL OR s.district = :district)
            ORDER BY s.station_name
            LIMIT :limit
            """
        ),
        {"district": district, "limit": limit},
    ).mappings().all()

    return [t for t in (_fit(db, s) for s in stations) if t is not None]


def compute_single_station_trend(db: Session, station_id: int) -> StationTrend | None:
    """Fits just one station — used by the detail view, which must not pay
    the cost of regressing every station in the database.
    """
    station = db.execute(
        text(f"SELECT {_STATION_COLUMNS} FROM gw_stations s WHERE s.id = :sid"),
        {"sid": station_id},
    ).mappings().one_or_none()
    if station is None:
        return None
    return _fit(db, station)
