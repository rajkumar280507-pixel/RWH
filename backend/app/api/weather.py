"""Weather Forecast Intelligence — read-only endpoint.

Entirely independent of every other router: no shared service, no shared
DB table, no dependency on `get_db`. Mounted additively in main.py.
"""
from fastapi import APIRouter, Query

from app.services.weather_service import get_forecast

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/forecast")
def forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    """Current weather + 7-day forecast for a location already selected
    elsewhere in the app (never asks the user for a location itself).
    Always returns 200 — failures surface as `unavailable`/`stale` fields
    in the body, never as an HTTP error, so a weather-provider outage can't
    break whatever page embeds this.
    """
    return get_forecast(lat, lon)
