"""REST API endpoints."""
from fastapi import APIRouter, HTTPException, Request
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
    return state.get_pilot(user_id)


@router.get("/pilot/{user_id}/history")
async def get_history(user_id: str):
    return state.get_flight_history(user_id)


@router.get("/flights")
async def get_flights():
    return list(state.get_flights().values())


@router.get("/shifts")
async def get_shifts():
    return state.get_shifts()


@router.get("/atis")
async def get_atis():
    return state.get_atis()


@router.get("/students")
async def get_students():
    return state.get_students()


@router.get("/top/pilots")
async def top_pilots():
    return state.get_top_pilots()


@router.get("/top/atc")
async def top_atc():
    return state.get_top_atc()


@router.get("/stats")
async def get_stats():
    return state.get_stats()


@router.get("/chart/weekly")
async def chart_weekly():
    """Реальная активность за 7 дней."""
    return state.get_weekly_activity()

@router.get("/pilot/{user_id}/extended")
async def get_pilot_extended(user_id: str):
    """Расширенный профиль: статистика + ачивки."""
    pilot = state.get_pilot(user_id)

    flights = pilot.get("flights", 0)
    hours = pilot.get("hours", 0)
    routes = pilot.get("routes", {})

    # Считаем ачивки
    achievements = []

    if flights >= 1:
        achievements.append({
            "id": "first_flight",
            "name": "Первый полёт",
            "emoji": "🛫",
            "description": "Выполнить первый рейс",
            "unlocked": True,
        })
    else:
        achievements.append({
            "id": "first_flight",
            "name": "Первый полёт",
            "emoji": "🛫",
            "description": "Выполнить первый рейс",
            "unlocked": False,
        })

    if flights >= 10:
        achievements.append({
            "id": "ten_flights",
            "name": "Опытный пилот",
            "emoji": "✈️",
            "description": "10 рейсов",
            "unlocked": True,
        })
    else:
        achievements.append({
            "id": "ten_flights",
            "name": "Опытный пилот",
            "emoji": "✈️",
            "description": f"10 рейсов (у тебя {flights})",
            "unlocked": False,
        })

    if flights >= 50:
        achievements.append({
            "id": "fifty_flights",
            "name": "Ветеран",
            "emoji": "🎖️",
            "description": "50 рейсов",
            "unlocked": True,
        })
    else:
        achievements.append({
            "id": "fifty_flights",
            "name": "Ветеран",
            "emoji": "🎖️",
            "description": f"50 рейсов (у тебя {flights})",
            "unlocked": False,
        })

    if hours >= 10:
        achievements.append({
            "id": "ten_hours",
            "name": "10 часов в небе",
            "emoji": "🕐",
            "description": "10 часов налёта",
            "unlocked": True,
        })
    else:
        achievements.append({
            "id": "ten_hours",
            "name": "10 часов в небе",
            "emoji": "🕐",
            "description": f"10 часов налёта (у тебя {hours:.1f} ч)",
            "unlocked": False,
        })

    if hours >= 100:
        achievements.append({
            "id": "hundred_hours",
            "name": "Мастер неба",
            "emoji": "👑",
            "description": "100 часов налёта",
            "unlocked": True,
        })
    else:
        achievements.append({
            "id": "hundred_hours",
            "name": "Мастер неба",
            "emoji": "👑",
            "description": f"100 часов налёта (у тебя {hours:.1f} ч)",
            "unlocked": False,
        })

    # Любимый маршрут
    favorite_route = None
    if routes:
        favorite_route = max(routes.items(), key=lambda x: x[1])

    # Топ аэропортов (по количеству вылетов)
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