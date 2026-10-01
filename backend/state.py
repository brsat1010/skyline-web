"""Чтение JSON-файлов, которые пишет Discord-бот."""
import json
import os
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("BOT_DATA_DIR", str(BASE_DIR.parent))).resolve()

DB_FILE = DATA_DIR / "database.json"
FLIGHTS_FILE = DATA_DIR / "active_flights.json"
ATC_SHIFTS_FILE = DATA_DIR / "atc_shifts.json"
ATIS_FILE = DATA_DIR / "atis.json"
STUDENTS_FILE = DATA_DIR / "students.json"


def _load(path, default):
    if not path.exists():
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[STATE] {path}: {e}")
        return default


def get_database():
    return _load(DB_FILE, {"pilots": {}, "flights_history": [], "warns": {}, "atc_reviews": {}})


def get_flights():
    return _load(FLIGHTS_FILE, {})


def get_shifts():
    return _load(ATC_SHIFTS_FILE, {})


def get_atis():
    return _load(ATIS_FILE, {})


def get_students():
    return _load(STUDENTS_FILE, {})


def get_pilot(user_id):
    db = get_database()
    uid = str(user_id)
    p = db.get("pilots", {}).get(uid)
    if not p:
        return {"flights": 0, "hours": 0.0, "routes": {},
                "first_flight": None, "last_flight": None,
                "display_name": None}
    return p


def get_flight_history(user_id, limit=10):
    db = get_database()
    uid = str(user_id)
    history = [f for f in db.get("flights_history", []) if str(f.get("user_id")) == uid]
    return history[-limit:][::-1]


def _format_pilot(uid, p):
    """Превращает запись пилота в безопасный ответ."""
    return {
        "user_id": uid,
        "display_name": p.get("display_name") or f"Пилот {str(uid)[-4:]}",
        "flights": p.get("flights", 0),
        "hours": p.get("hours", 0),
        "routes": p.get("routes", {}),
        "first_flight": p.get("first_flight"),
        "last_flight": p.get("last_flight"),
    }


def get_top_pilots(limit=10):
    db = get_database()
    pilots = db.get("pilots", {})
    sorted_p = sorted(pilots.items(),
                      key=lambda x: x[1].get("flights", 0),
                      reverse=True)[:limit]
    return [_format_pilot(uid, p) for uid, p in sorted_p if p.get("flights", 0) > 0]


def get_top_atc(limit=10):
    db = get_database()
    stats = db.get("atc_reviews", {})
    sorted_s = sorted(stats.items(),
                      key=lambda x: x[1].get("reviewed", 0),
                      reverse=True)[:limit]
    return [
        {
            "user_id": uid,
            "user_name": s.get("user_name") or f"УВД {str(uid)[-4:]}",
            "reviewed": s.get("reviewed", 0),
            "approved": s.get("approved", 0),
            "rejected": s.get("rejected", 0),
        }
        for uid, s in sorted_s
        if s.get("reviewed", 0) > 0
    ]


def get_stats():
    db = get_database()
    flights = get_flights()
    shifts = get_shifts()
    return {
        "total_pilots": len(db.get("pilots", {})),
        "total_flights": len(db.get("flights_history", [])),
        "active_flights": len(flights),
        "active_shifts": len(shifts),
        "total_reviews": sum(s.get("reviewed", 0) for s in db.get("atc_reviews", {}).values()),
    }


def get_weekly_activity():
    """Реальная активность за последние 7 дней из flights_history."""
    db = get_database()
    history = db.get("flights_history", [])
    today = datetime.now().date()
    days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

    # Последние 7 дней (включая сегодня)
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = 0
        for f in history:
            at = f.get("at")
            if not at:
                continue
            try:
                # Формат: "2026-10-01 14:30"
                d = datetime.strptime(at, "%Y-%m-%d %H:%M").date()
                if d == day:
                    count += 1
            except ValueError:
                continue
        result.append({
            "day": days[day.weekday()],
            "date": day.strftime("%d.%m"),
            "count": count,
        })
    return result