"""Skyline Web Backend — FastAPI."""
import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

load_dotenv()

from .auth import oauth
from .api import router as api_router
from .websocket import router as ws_router, push_loop
from .voice import router as voice_router

WEB_SECRET_KEY = os.getenv("WEB_SECRET_KEY", "change-me-in-production")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(push_loop())
    print("[WEB] Сервер запущен")
    yield
    task.cancel()
    print("[WEB] Сервер остановлен")


app = FastAPI(title="Skyline Web", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=WEB_SECRET_KEY)


@app.get("/auth/login")
async def login(request: Request):
    redirect_uri = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:8000/auth/callback")
    return await oauth.discord.authorize_redirect(request, redirect_uri)


@app.get("/auth/callback")
async def callback(request: Request):
    try:
        token = await oauth.discord.authorize_access_token(request)
        resp = await oauth.discord.get("users/@me", token=token)
        user = resp.json()
        request.session["user"] = {
            "id": user["id"],
            "username": user["username"],
            "global_name": user.get("global_name"),
            "avatar": user.get("avatar"),
        }
        return RedirectResponse(url="/")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@app.get("/auth/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return RedirectResponse(url="/")


@app.get("/auth/me")
async def me(request: Request):
    return request.session.get("user") or {}


app.include_router(api_router)
app.include_router(ws_router)
app.include_router(voice_router)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")