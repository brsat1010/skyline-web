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
    return await state.get_pilot(user_id)


@router.get("/pilot/{user_id}/history")
async def get_history(user_id: str):
    return await state.get_flight_history(user_id)


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