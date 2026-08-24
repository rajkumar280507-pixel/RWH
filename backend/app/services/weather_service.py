"""Weather Forecast Intelligence — independent weather data service.

Data source: Open-Meteo (https://open-meteo.com), a genuinely public,
keyless forecast API. IMD's official API was the first choice, but it
requires a government/institutional API key + JWT the project does not
currently have (verified: https://api.imd.gov.in/api/v1/current_wx returns
401 without both an `X-Api-Key` header and a valid `Authorization: Bearer`
JWT) — rather than fabricate weather data or fake an IMD response, this
swaps in a real, working data source. Swapping back to IMD later only means
replacing `_fetch_from_provider()` below; every caller (the API route, the
frontend) is written against this module's normalized shape, not
Open-Meteo's response shape directly.

Entirely independent of the recharge/telemetry pipeline: no shared tables,
no shared client, no shared cache. An outage here can never affect the rest
of the app — every public function catches its own failures and returns a
clearly-flagged unavailable/stale response instead of raising.
"""
from __future__ import annotations

import logging
import time

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger("rwh.weather_service")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 30 * 60  # "refresh every 30 minutes" per the module spec
HTTP_TIMEOUT_SECONDS = 12

# In-process cache only (no DB table) — weather is inherently short-lived
# data, not a permanent record worth a schema change for a first pass.
# Keyed by (lat, lon) rounded to 2dp (~1km) so nearby requests share a slot.
_cache: dict[tuple[float, float], dict] = {}

# WMO weather codes (used by Open-Meteo) -> a short label + a rough icon
# category. https://open-meteo.com/en/docs — official WMO code table.
WMO_CODES = {
    0: ("Clear sky", "clear"),
    1: ("Mainly clear", "clear"),
    2: ("Partly cloudy", "cloudy"),
    3: ("Overcast", "cloudy"),
    45: ("Fog", "fog"),
    48: ("Depositing rime fog", "fog"),
    51: ("Light drizzle", "rain"),
    53: ("Moderate drizzle", "rain"),
    55: ("Dense drizzle", "rain"),
    61: ("Slight rain", "rain"),
    63: ("Moderate rain", "rain"),
    65: ("Heavy rain", "rain"),
    66: ("Light freezing rain", "rain"),
    67: ("Heavy freezing rain", "rain"),
    71: ("Slight snow", "snow"),
    73: ("Moderate snow", "snow"),
    75: ("Heavy snow", "snow"),
    80: ("Slight rain showers", "rain"),
    81: ("Moderate rain showers", "rain"),
    82: ("Violent rain showers", "rain"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm with slight hail", "storm"),
    99: ("Thunderstorm with heavy hail", "storm"),
}


class WeatherServiceError(RuntimeError):
    pass


def _describe(code: int | None) -> tuple[str, str]:
    if code is None:
        return "Unknown", "unknown"
    return WMO_CODES.get(code, ("Unknown", "unknown"))


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type(httpx.HTTPError),
)
def _fetch_from_provider(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
        "timezone": "auto",
        "forecast_days": 7,
    }
    with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = client.get(OPEN_METEO_URL, params=params)
    response.raise_for_status()
    return response.json()


def _normalize(raw: dict, lat: float, lon: float) -> dict:
    current = raw.get("current", {})
    daily = raw.get("daily", {})
    label, icon = _describe(current.get("weather_code"))

    days = []
    dates = daily.get("time", [])
    for i, date in enumerate(dates):
        d_label, d_icon = _describe((daily.get("weather_code") or [None] * len(dates))[i])
        days.append(
            {
                "date": date,
                "weather_label": d_label,
                "icon": d_icon,
                "temp_max_c": (daily.get("temperature_2m_max") or [None] * len(dates))[i],
                "temp_min_c": (daily.get("temperature_2m_min") or [None] * len(dates))[i],
                "rainfall_mm": (daily.get("precipitation_sum") or [None] * len(dates))[i],
                "rain_probability_pct": (daily.get("precipitation_probability_max") or [None] * len(dates))[i],
                "wind_speed_kmh": (daily.get("wind_speed_10m_max") or [None] * len(dates))[i],
            }
        )

    return {
        "source": "Open-Meteo (open-meteo.com) — IMD official API not integrated: no API credentials available. See module docstring.",
        "location": {"lat": lat, "lon": lon},
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "feels_like_c": current.get("apparent_temperature"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "rainfall_mm": current.get("precipitation"),
            "weather_label": label,
            "icon": icon,
            "observed_at": current.get("time"),
        },
        "daily": days,
        "fetched_at": time.time(),
        "stale": False,
    }


def get_forecast(lat: float, lon: float) -> dict:
    """Returns normalized current + 7-day forecast for a location. Never
    raises — on any failure, returns the last good cached response with
    `stale: True`, or an explicit `unavailable` payload if nothing is
    cached yet, so a weather outage can never break the page that embeds it.
    """
    key = (round(lat, 2), round(lon, 2))
    cached = _cache.get(key)
    if cached and time.time() - cached["fetched_at"] < CACHE_TTL_SECONDS:
        return cached

    try:
        raw = _fetch_from_provider(lat, lon)
        normalized = _normalize(raw, lat, lon)
        _cache[key] = normalized
        return normalized
    except Exception:
        logger.exception("Weather fetch failed for (%s, %s)", lat, lon)
        if cached:
            return {**cached, "stale": True}
        return {
            "source": None,
            "location": {"lat": lat, "lon": lon},
            "current": None,
            "daily": [],
            "fetched_at": time.time(),
            "stale": True,
            "unavailable": True,
        }
