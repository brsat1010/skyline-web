"""Подключение к MongoDB и коллекции."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "skyline")

_client: Optional[AsyncIOMotorClient] = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        if not MONGO_URI:
            raise RuntimeError("MONGO_URI не задан в .env")
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[MONGO_DB_NAME]
    return _db


async def ensure_indexes():
    """Создаёт индексы для быстрого поиска."""
    db = get_db()

    # _id НЕ требует индекса — он уникален по умолчанию

    await db.flights_history.create_index("user_id")
    await db.flights_history.create_index("at")
    await db.active_flights.create_index("status")
    await db.event_signups.create_index("event_id")
    await db.event_signups.create_index("user_id")
    await db.tickets.create_index("user_id")
    await db.tickets.create_index("status")

    print("[DB] Индексы созданы")