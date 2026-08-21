"""Aggregate stats for the dashboard's top-row stat cards."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.telemetry import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_STATS_SQL = text(
    """
    SELECT
        (SELECT COUNT(*) FROM gw_stations) AS gw_station_count,
        (SELECT COUNT(*) FROM rainfall_stations) AS rainfall_station_count,
        (SELECT AVG(water_level_m) FROM v_gw_latest) AS avg_groundwater_level_m,
        (SELECT AVG(rainfall_mm) FROM v_rainfall_latest) AS avg_rainfall_mm,
        (SELECT MAX(finished_at) FROM sync_runs WHERE source = 'groundwater' AND status IN ('success','partial')) AS last_gw_sync,
        (SELECT MAX(finished_at) FROM sync_runs WHERE source = 'rainfall' AND status IN ('success','partial')) AS last_rainfall_sync
    """
)


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    row = db.execute(_STATS_SQL).mappings().one()
    return DashboardStats.model_validate(row)



@router.get("/district-summary")
def district_summary(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM v_district_summary ORDER BY district")).mappings().all()
    return list(rows)
