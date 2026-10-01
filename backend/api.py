"""REST API endpoints."""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta
from . import state

router = APIRouter(prefix="/api")


@router.get("/me")
async def get_me(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Не авторизован")
    return user


@router.get("/pilot/{user_id}")
async def get_pilot(user_id: str):
    return await state.get_pilot(user_id)


@router.get("/pilot/{user_id}/history")
async def get_history(user_id: str):
    return await state.get_flight_history(user_id)


@router.get("/pilot/{user_id}/extended")
async def get_pilot_extended(user_id: str):
    """Расширенный профиль: статистика + ачивки."""
    pilot = await state.get_pilot(user_id)

    flights = pilot.get("flights", 0)
    hours = pilot.get("hours", 0)
    routes = pilot.get("routes", {})

    achievements = []

    achievements.append({
        "id": "first_flight", "name": "Первый полёт", "emoji": "🛫",
        "description": "Выполнить первый рейс" if flights >= 1 else f"Выполнить первый рейс (у тебя {flights})",
        "unlocked": flights >= 1,
    })
    achievements.append({
        "id": "ten_flights", "name": "Опытный пилот", "emoji": "✈️",
        "description": "10 рейсов" if flights >= 10 else f"10 рейсов (у тебя {flights})",
        "unlocked": flights >= 10,
    })
    achievements.append({
        "id": "fifty_flights", "name": "Ветеран", "emoji": "🎖️",
        "description": "50 рейсов" if flights >= 50 else f"50 рейсов (у тебя {flights})",
        "unlocked": flights >= 50,
    })
    achievements.append({
        "id": "ten_hours", "name": "10 часов в небе", "emoji": "🕐",
        "description": f"10 часов налёта ({hours:.1f} ч)" if hours >= 10 else f"10 часов налёта (у тебя {hours:.1f} ч)",
        "unlocked": hours >= 10,
    })
    achievements.append({
        "id": "hundred_hours", "name": "Мастер неба", "emoji": "👑",
        "description": f"100 часов налёта ({hours:.1f} ч)" if hours >= 100 else f"100 часов налёта (у тебя {hours:.1f} ч)",
        "unlocked": hours >= 100,
    })

    favorite_route = None
    if routes:
        favorite_route = max(routes.items(), key=lambda x: x[1])

    airport_counts = {}
    for route, count in routes.items():
        if " → " in route:
            dep, arr = route.split(" → ", 1)
            airport_counts[dep] = airport_counts.get(dep, 0) + count
            airport_counts[arr] = airport_counts.get(arr, 0) + count
    top_airports = sorted(airport_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "user_id": user_id,
        "display_name": pilot.get("display_name", f"Пилот {str(user_id)[-4:]}"),
        "flights": flights,
        "hours": hours,
        "routes_count": len(routes),
        "first_flight": pilot.get("first_flight"),
        "last_flight": pilot.get("last_flight"),
        "favorite_route": favorite_route[0] if favorite_route else None,
        "favorite_route_count": favorite_route[1] if favorite_route else 0,
        "top_airports": top_airports,
        "achievements": achievements,
    }


@router.get("/flights")
async def get_flights():
    return list((await state.get_flights()).values())


@router.get("/shifts")
async def get_shifts():
    return await state.get_shifts()


@router.get("/atis")
async def get_atis():
    return await state.get_atis()


@router.get("/students")
async def get_students():
    return await state.get_students()


@router.get("/top/pilots")
async def top_pilots():
    return await state.get_top_pilots()


@router.get("/top/atc")
async def top_atc():
    return await state.get_top_atc()


@router.get("/stats")
async def get_stats():
    return await state.get_stats()


@router.get("/chart/weekly")
async def chart_weekly():
    """Реальная активность за 7 дней."""
    db = state.get_db()
    history = []
    async for doc in db.flights_history.find({}):
        doc.pop("_id", None)
        history.append(doc)

    today = datetime.now().date()
    days_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = 0
        for f in history:
            at = f.get("at")
            if not at:
                continue
            try:
                d = datetime.strptime(at, "%Y-%m-%d %H:%M").date()
                if d == day:
                    count += 1
            except ValueError:
                continue
        result.append({
            "day": days_names[day.weekday()],
            "date": day.strftime("%d.%m"),
            "count": count,
        })
    return result