"""Sync status/history endpoints, plus a manual trigger for operators who
don't want to wait for the next hourly tick.
"""
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.schemas.telemetry import SyncRunOut
from app.scheduler.jobs import run_groundwater_sync, run_rainfall_sync

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.get("/runs", response_model=list[SyncRunOut])
def recent_runs(source: str | None = None, db: Session = Depends(get_db)):
    sql = "SELECT * FROM sync_runs WHERE (:source IS NULL OR source = :source) ORDER BY started_at DESC LIMIT 50"
    rows = db.execute(text(sql), {"source": source}).mappings().all()
    return [SyncRunOut(**row) for row in rows]


@router.get("/health")
def sync_health(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM v_sync_health")).mappings().all()
    return list(rows)


@router.post("/trigger")
def trigger_sync(
    background_tasks: BackgroundTasks,
    source: str = "both",
    _user: str = Depends(get_current_user),
):
    """Requires auth: kicks off an out-of-band sync without blocking the request."""
    if source in ("groundwater", "both"):
        background_tasks.add_task(run_groundwater_sync)
    if source in ("rainfall", "both"):
        background_tasks.add_task(run_rainfall_sync)
    return {"status": "triggered", "source": source}
