"""Broadcast manager for live dashboard updates over WebSocket.

The scheduler and sync service push JSON-serializable dicts here; every
connected browser tab gets them fanned out. Kept in-process (no Redis pub/sub)
for this milestone — swap for a Redis-backed broadcaster if the API is ever
run as more than one worker process.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger("rwh.websocket")


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        self._loop = asyncio.get_running_loop()

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def broadcast_threadsafe(self, message: dict) -> None:
        """Called from the (synchronous, background-thread) scheduler job."""
        if self._loop is None or not self._connections:
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)
        except RuntimeError:
            logger.warning("Event loop unavailable for WS broadcast", exc_info=True)


manager = ConnectionManager()
