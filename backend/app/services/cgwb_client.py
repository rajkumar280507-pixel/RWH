"""HTTP client for the CGWB / National Water Informatics Data Portal (NWDP)
CKAN datastore_search API.

The endpoints are standard CKAN `datastore_search` resources, which respond
with:

    {
      "success": true,
      "result": {
        "total": 123456,
        "records": [ {...}, {...} ],
        "fields": [ {"id": "...", "type": "..."}, ... ]
      }
    }

and support offset/limit pagination via query params `offset` and `limit`.
Field names on NWDP resources are not perfectly standardized across
datasets, so `sync_service.py` maps a handful of known aliases rather than
assuming one exact schema.
"""
from __future__ import annotations

import logging

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config.settings import get_settings

logger = logging.getLogger("rwh.cgwb_client")

settings = get_settings()


class CgwbApiError(RuntimeError):
    pass


class CgwbClient:
    """Thin wrapper around one CKAN datastore_search resource."""

    def __init__(self, base_url: str, resource_id: str):
        self.base_url = base_url
        self.resource_id = resource_id

    @retry(
        reraise=True,
        stop=stop_after_attempt(get_settings().sync_max_retries),
        wait=wait_exponential(multiplier=1, min=2, max=get_settings().sync_retry_backoff_seconds),
        retry=retry_if_exception_type((httpx.HTTPError, CgwbApiError)),
    )
    def fetch_page(self, offset: int, limit: int) -> dict:
        """Fetch one page of records. Raises after exhausting retries so the
        caller can log the failure against the current sync_run and move on.
        """
        params = {"resource_id": self.resource_id, "offset": offset, "limit": limit}
        with httpx.Client(timeout=settings.sync_http_timeout_seconds) as client:
            response = client.get(self.base_url, params=params)
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success"):
            raise CgwbApiError(f"CGWB API returned success=false: {payload}")
        return payload["result"]

    def iter_all_records(self, page_size: int | None = None):
        """Generator yielding (offset, records, total) for every page,
        stopping once `offset >= total` or an empty page is returned.
        """
        page_size = page_size or settings.sync_page_size
        offset = 0
        while True:
            result = self.fetch_page(offset=offset, limit=page_size)
            records = result.get("records", [])
            total = result.get("total", 0)
            if not records:
                return
            yield offset, records, total
            offset += len(records)
            if offset >= total:
                return
