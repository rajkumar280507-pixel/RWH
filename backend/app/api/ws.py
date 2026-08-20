"""WebSocket endpoint the dashboard subscribes to for live sync progress and
completion events, pushed by the scheduler (see app/scheduler/jobs.py).
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/live")
async def live_updates(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Client doesn't need to send anything; keep the connection open
            # and drop it cleanly on disconnect. Receiving is only used to
            # detect the disconnect promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
