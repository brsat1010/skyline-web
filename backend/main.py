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
from . import db

WEB_SECRET_KEY = os.getenv("WEB_SECRET_KEY", "change-me-in-production")
GUILD_ID = int(os.getenv("GUILD_ID", "1254445111845326949"))
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.ensure_indexes()
    except Exception as e:
        print(f"[DB] Ошибка индексов: {e}")

    task = asyncio.create_task(push_loop())
    print("[WEB] Сервер запущен")
    yield
    task.cancel()
    try:
        db.get_client().close()
    except Exception:
        pass
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

        roles = []
        try:
            guilds_resp = await oauth.discord.get("users/@me/guilds", token=token)
            guilds = guilds_resp.json()

            for guild in guilds:
                if int(guild["id"]) == GUILD_ID:
                    member_resp = await oauth.discord.get(
                        f"guilds/{GUILD_ID}/members/{user['id']}",
                        token=token,
                    )
                    if member_resp.status_code == 200:
                        member_data = member_resp.json()
                        role_ids = member_data.get("roles", [])
                        roles_data = await oauth.discord.get(
                            f"guilds/{GUILD_ID}/roles",
                            token=token,
                        )
                        all_roles = {r["id"]: r["name"] for r in roles_data.json()}
                        roles = [all_roles.get(rid, "") for rid in role_ids]
                    break
        except Exception as e:
            print(f"[AUTH] Не удалось получить роли: {e}")

        request.session["user"] = {
            "id": user["id"],
            "username": user["username"],
            "global_name": user.get("global_name"),
            "avatar": user.get("avatar"),
            "roles": roles,
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