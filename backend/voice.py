"""WebRTC голосовая связь через WebSocket-сигналинг."""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class VoiceRoom:
    """Комната голосовой связи: 2 участника (пилот + УВД)."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.participants: dict[str, WebSocket] = {}  # user_id -> websocket

    async def join(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.participants[user_id] = ws

        # Уведомляем других что мы зашли
        for uid, other_ws in self.participants.items():
            if uid != user_id:
                try:
                    await other_ws.send_json({
                        "type": "peer_joined",
                        "user_id": user_id,
                        "count": len(self.participants),
                    })
                except Exception:
                    pass

    def leave(self, user_id: str):
        self.participants.pop(user_id, None)

    async def broadcast(self, sender_id: str, message: dict):
        """Пересылает сообщение всем КРОМЕ отправителя."""
        for uid, ws in list(self.participants.items()):
            if uid == sender_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass

    @property
    def is_empty(self):
        return len(self.participants) == 0


# Глобальное хранилище комнат
rooms: dict[str, VoiceRoom] = {}


def get_or_create_room(room_id: str) -> VoiceRoom:
    if room_id not in rooms:
        rooms[room_id] = VoiceRoom(room_id)
    return rooms[room_id]


@router.websocket("/voice/{room_id}/{user_id}")
async def voice_ws(ws: WebSocket, room_id: str, user_id: str):
    """WebRTC сигналинг."""
    room = get_or_create_room(room_id)

    # Максимум 2 участника
    if len(room.participants) >= 2 and user_id not in room.participants:
        await ws.close(code=4000, reason="Room is full")
        return

    await room.join(user_id, ws)

    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            # Просто пересылаем offer/answer/ice между участниками
            if msg_type in ("offer", "answer", "ice", "mute", "speaking"):
                msg["from"] = user_id
                await room.broadcast(user_id, msg)

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[VOICE] {e}")
    finally:
        room.leave(user_id)
        # Уведомляем оставшихся
        await room.broadcast(user_id, {
            "type": "peer_left",
            "user_id": user_id,
            "count": len(room.participants),
        })
        # Удаляем пустую комнату
        if room.is_empty and room_id in rooms:
            del rooms[room_id]