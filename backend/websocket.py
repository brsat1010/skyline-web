"""WebSocket для push-обновлений."""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from . import state

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active = []

    async def connect(self, ws):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message):
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


async def push_loop():
    last_fp = None
    while True:
        await asyncio.sleep(5)
        try:
            data = {
                "flights": state.get_flights(),
                "shifts": state.get_shifts(),
                "atis": state.get_atis(),
                "stats": state.get_stats(),
            }
            fp = json.dumps(data, sort_keys=True, default=str)
            if fp != last_fp:
                last_fp = fp
                await manager.broadcast({"type": "update", "data": data})
        except Exception as e:
            print(f"[WS] {e}")