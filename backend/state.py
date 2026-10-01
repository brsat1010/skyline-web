"""Чтение данных из MongoDB."""
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


async def get_database():
    """Возвращает весь документ database (для совместимости)."""
    db = get_db()

    pilots = {}
    async for doc in db.pilots.find({}):
        uid = doc.pop("_id")
        pilots[str(uid)] = doc

    history = []
    async for doc in db.flights_history.find({}).sort("_id", -1).limit(500):
        doc.pop("_id", None)
        history.append(doc)

    warns = {}
    async for doc in db.warns.find({}):
        uid = doc.pop("_id")
        warns[str(uid)] = doc.get("items", [])

    atc_reviews = {}
    async for doc in db.atc_reviews.find({}):
        uid = doc.pop("_id")
        atc_reviews[str(uid)] = doc

    return {
        "pilots": pilots,
        "flights_history": history,
        "warns": warns,
        "atc_reviews": atc_reviews,
    }


async def get_flights():
    flights = {}
    async for doc in get_db().active_flights.find({}):
        pilot_id = doc.pop("_id")
        flights[str(pilot_id)] = doc
    return flights


async def get_shifts():
    shifts = {}
    async for doc in get_db().atc_shifts.find({}):
        icao = doc.pop("_id")
        shifts[icao] = doc
    return shifts


async def get_atis():
    atis = {}
    async for doc in get_db().atis.find({}):
        icao = doc.pop("_id")
        atis[icao] = doc
    return atis


async def get_students():
    students = {}
    async for doc in get_db().students.find({}):
        uid = doc.pop("_id")
        students[str(uid)] = doc
    return students


async def get_pilot(user_id: str):
    uid = str(user_id)
    doc = await get_db().pilots.find_one({"_id": uid})
    if not doc:
        return {"flights": 0, "hours": 0.0, "routes": {},
                "first_flight": None, "last_flight": None,
                "display_name": None}
    doc.pop("_id", None)
    return doc


async def get_flight_history(user_id: str, limit=10):
    uid = str(user_id)
    cursor = get_db().flights_history.find({"user_id": uid}).sort("_id", -1).limit(limit)
    history = []
    async for doc in cursor:
        doc.pop("_id", None)
        history.append(doc)
    return history


async def _format_pilot(uid, p):
    return {
        "user_id": str(uid),
        "display_name": p.get("display_name") or f"Пилот {str(uid)[-4:]}",
        "flights": p.get("flights", 0),
        "hours": p.get("hours", 0),
        "routes": p.get("routes", {}),
        "first_flight": p.get("first_flight"),
        "last_flight": p.get("last_flight"),
    }


async def get_top_pilots(limit=10):
    cursor = get_db().pilots.find({"flights": {"$gt": 0}}).sort("flights", -1).limit(limit)
    result = []
    async for doc in cursor:
        uid = doc.pop("_id")
        result.append(await _format_pilot(uid, doc))
    return result


async def get_top_atc(limit=10):
    cursor = get_db().atc_reviews.find({"reviewed": {"$gt": 0}}).sort("reviewed", -1).limit(limit)
    result = []
    async for doc in cursor:
        uid = doc.pop("_id")
        result.append({
            "user_id": str(uid),
            "user_name": doc.get("user_name") or f"УВД {str(uid)[-4:]}",
            "reviewed": doc.get("reviewed", 0),
            "approved": doc.get("approved", 0),
            "rejected": doc.get("rejected", 0),
        })
    return result


async def get_stats():
    db = get_db()
    total_pilots = await db.pilots.count_documents({})
    total_flights = await db.flights_history.count_documents({})
    active_flights = await db.active_flights.count_documents({})
    active_shifts = await db.atc_shifts.count_documents({})

    total_reviews = 0
    async for doc in db.atc_reviews.find({}):
        total_reviews += doc.get("reviewed", 0)

    return {
        "total_pilots": total_pilots,
        "total_flights": total_flights,
        "active_flights": active_flights,
        "active_shifts": active_shifts,
        "total_reviews": total_reviews,
    }