"""RWH-DSS FastAPI application entrypoint.

Wires: CORS, REST routers (auth, telemetry, dashboard, sync), the live
WebSocket endpoint, and the hourly CGWB sync scheduler.
"""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, dashboard, predictions, reports, rwh_design, sync, telemetry, ws
from app.config.settings import get_settings
from app.scheduler.jobs import shutdown_scheduler, start_scheduler, trigger_initial_sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("rwh.main")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-Based Rooftop Rainwater Harvesting Decision Support System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(telemetry.router)
app.include_router(dashboard.router)
app.include_router(sync.router)
app.include_router(rwh_design.router)
app.include_router(predictions.router)
app.include_router(reports.router)
app.include_router(ws.router)

# Serves generated PDF reports and their QR codes (Phase 7), written to
# backend/static/reports/ by app/api/reports.py.
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@app.on_event("startup")
def on_startup():
    start_scheduler()
    trigger_initial_sync()
    logger.info("%s started (%s)", settings.app_name, settings.environment)


@app.on_event("shutdown")
def on_shutdown():
    shutdown_scheduler()
