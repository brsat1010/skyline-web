"""Одноразовая миграция JSON → MongoDB."""
import os
import json
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "skyline")

# Путь к данным бота
DATA_DIR = Path(os.getenv("BOT_DATA_DIR", "../skyline-main"))

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

print(f"✅ Подключение к MongoDB: {MONGO_DB_NAME}")


def load_json(filename, default):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"⚠️ {filename} не найден")
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# === 1. PILOTS ===
pilots = load_json("database.json", {}).get("pilots", {})
if pilots:
    for uid, data in pilots.items():
        db.pilots.update_one({"_id": str(uid)}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено пилотов: {len(pilots)}")

# === 2. FLIGHTS_HISTORY ===
history = load_json("database.json", {}).get("flights_history", [])
if history:
    db.flights_history.delete_many({})
    db.flights_history.insert_many(history)
    print(f"✅ Перенесено рейсов: {len(history)}")

# === 3. WARNS ===
warns = load_json("database.json", {}).get("warns", {})
if warns:
    for uid, items in warns.items():
        db.warns.update_one({"_id": str(uid)}, {"$set": {"items": items}}, upsert=True)
    print(f"✅ Перенесено варнов: {len(warns)}")

# === 4. ATC_REVIEWS ===
reviews = load_json("database.json", {}).get("atc_reviews", {})
if reviews:
    for uid, data in reviews.items():
        db.atc_reviews.update_one({"_id": str(uid)}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено отзывов УВД: {len(reviews)}")

# === 5. ACTIVE_FLIGHTS ===
flights = load_json("active_flights.json", {})
if flights:
    for uid, data in flights.items():
        db.active_flights.update_one({"_id": str(uid)}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено активных рейсов: {len(flights)}")

# === 6. ATC_SHIFTS ===
shifts = load_json("atc_shifts.json", {})
if shifts:
    for icao, data in shifts.items():
        db.atc_shifts.update_one({"_id": icao}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено смен УВД: {len(shifts)}")

# === 7. ATIS ===
atis = load_json("atis.json", {})
if atis:
    for icao, data in atis.items():
        db.atis.update_one({"_id": icao}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено ATIS: {len(atis)}")

# === 8. STUDENTS ===
students = load_json("students.json", {})
if students:
    for uid, data in students.items():
        db.students.update_one({"_id": str(uid)}, {"$set": data}, upsert=True)
    print(f"✅ Перенесено курсантов: {len(students)}")

print("\n🎉 Миграция завершена!")