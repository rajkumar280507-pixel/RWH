"""Groundwater trend / prediction endpoints.

Backed by ordinary least-squares regression over each station's real synced
history (app/services/trend_service.py) — not a pretrained model. Results
always carry sample size, span and R² so thin series are visibly thin.
"""
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services import trend_service

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("/groundwater-trends")
def groundwater_trends(
    district: str | None = Query(default=None),
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_db),
):
    trends = trend_service.compute_station_trends(db, district=district, limit=limit)
    rows = [asdict(t) for t in trends]

    falling = [r for r in rows if r["trend"] == "falling"]
    rising = [r for r in rows if r["trend"] == "rising"]
    stable = [r for r in rows if r["trend"] == "stable"]
    sub_annual = [r for r in rows if r["days_span"] < trend_service.FULL_SEASONAL_CYCLE_DAYS]

    return {
        "method": (
            "Ordinary least-squares linear regression on each station's own synced CGWB "
            "reading history, after normalizing every value to a positive depth below "
            "ground. Not a pretrained ML model — every figure is reproducible from the "
            "rows in gw_readings."
        ),
        "limitation": (
            f"{len(sub_annual)} of {len(rows)} stations currently have under a full year of "
            "telemetry. For those, the m/yr slope extrapolates the current seasonal phase "
            "and will overstate real aquifer change — they are all marked low confidence. "
            "Treat this page as a monitoring aid, not as a basis for policy, until stations "
            "accumulate a full seasonal cycle."
        ),
        "summary": {
            "stations_analysed": len(rows),
            "falling": len(falling),
            "rising": len(rising),
            "stable": len(stable),
            "high_confidence": len([r for r in rows if r["confidence"] == "high"]),
            "sub_annual_span": len(sub_annual),
            "excluded_note": (
                f"Stations with fewer than {trend_service.MIN_READINGS} readings or under "
                f"{trend_service.MIN_DAYS_SPAN} days of span are excluded rather than fitted to noise."
            ),
        },
        # Steepest decline first — that's the actionable end of the list for
        # recharge-siting decisions. Depth increasing = table falling, so the
        # largest positive slope is the most-declining station.
        "trends": sorted(rows, key=lambda r: -r["slope_m_per_year"]),
    }


@router.get("/station/{station_id}/series")
def station_series(station_id: int, db: Session = Depends(get_db)):
    """Full observed series plus the fitted line, for the detail chart."""
    station = db.execute(
        text("SELECT id, station_code, station_name, district FROM gw_stations WHERE id = :sid"),
        {"sid": station_id},
    ).mappings().one_or_none()
    if station is None:
        raise HTTPException(404, "Station not found")

    rows = db.execute(
        text(
            """
            SELECT recorded_at, water_level_m
            FROM gw_readings
            WHERE station_id = :sid AND water_level_m IS NOT NULL
            ORDER BY recorded_at ASC
            """
        ),
        {"sid": station_id},
    ).mappings().all()

    fitted = trend_service.compute_single_station_trend(db, station_id)
    trend = asdict(fitted) if fitted else None

    return {
        "station": dict(station),
        "series": [
            {"recorded_at": r["recorded_at"].isoformat(), "water_level_m": float(r["water_level_m"])}
            for r in rows
        ],
        "trend": trend,
    }
