"""APScheduler wiring: runs the CGWB groundwater + rainfall sync every
`settings.sync_interval_minutes` (default hourly), and fans progress out over
the WebSocket manager so the dashboard's "Recent Synchronization" panel and
stat cards update live without a page refresh.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config.settings import get_settings
from app.database.session import SessionLocal
from app.models.telemetry import SyncRun
from app.services.sync_service import SyncService
from app.websocket.manager import manager

logger = logging.getLogger("rwh.scheduler")
settings = get_settings()

scheduler = BackgroundScheduler(timezone="UTC")


def _broadcast(payload: dict) -> None:
    manager.broadcast_threadsafe({"type": "sync_progress", **payload})


def run_groundwater_sync() -> None:
    db = SessionLocal()
    try:
        service = SyncService(db, on_progress=_broadcast)
        run = service.sync_groundwater()
        manager.broadcast_threadsafe(
            {
                "type": "sync_complete",
                "source": "groundwater",
                "status": run.status,
                "records_upserted": run.records_upserted,
                "records_failed": run.records_failed,
            }
        )
    except Exception:  # noqa: BLE001 - a failed job must not kill the scheduler
        logger.exception("Groundwater sync job crashed")
    finally:
        db.close()


def run_rainfall_sync() -> None:
    db = SessionLocal()
    try:
        service = SyncService(db, on_progress=_broadcast)
        run = service.sync_rainfall()
        manager.broadcast_threadsafe(
            {
                "type": "sync_complete",
                "source": "rainfall",
                "status": run.status,
                "records_upserted": run.records_upserted,
                "records_failed": run.records_failed,
            }
        )
    except Exception:  # noqa: BLE001
        logger.exception("Rainfall sync job crashed")
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        run_groundwater_sync,
        trigger=IntervalTrigger(minutes=settings.sync_interval_minutes),
        id="sync_groundwater",
        next_run_time=None,  # first run kicked off manually at startup, see main.py
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_rainfall_sync,
        trigger=IntervalTrigger(minutes=settings.sync_interval_minutes),
        id="sync_rainfall",
        next_run_time=None,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scheduler started: sync every %s minutes", settings.sync_interval_minutes)


def _mark_orphaned_runs_failed() -> None:
    """A process that's just starting up cannot own a `sync_runs` row still
    marked "running" — that row belongs to a previous process instance that
    was killed (redeploy, crash, container restart) before it reached the
    `finally` block in `SyncService._run_sync()` that would otherwise always
    set a final status. Left alone, these rows permanently poison
    `dashboard.last_gw_sync`/`last_rainfall_sync` (which only count
    'success'/'partial' rows), making completed syncs invisible.
    """
    db = SessionLocal()
    try:
        orphaned = db.query(SyncRun).filter(SyncRun.status == "running").all()
        if not orphaned:
            return
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for run in orphaned:
            run.status = "failed"
            run.finished_at = now
            run.error_message = "Interrupted: process restarted before this sync run finished."
        db.commit()
        logger.warning("Marked %d orphaned sync_runs row(s) as failed on startup", len(orphaned))
    finally:
        db.close()


def trigger_initial_sync() -> None:
    """Run both syncs once immediately in the background, then let the
    interval trigger take over for subsequent hourly runs.
    """
    _mark_orphaned_runs_failed()
    scheduler.add_job(run_groundwater_sync, id="sync_groundwater_initial")
    scheduler.add_job(run_rainfall_sync, id="sync_rainfall_initial")


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
