"""Роли и права на сайте."""
import os
from typing import Optional
from fastapi import Request, HTTPException

DISCORD_ROLES_MAP = {
    "Администратор": "admin",
    "Владелец": "owner",
    "Модератор": "moderator",
    "Инструктор": "instructor",
    "УВД": "atc",
    "Диспетчер": "atc",
    "Пилот": "pilot",
    "Курсант-пилот": "student",
    "Курсант-УВД": "student",
    "Unverified": "guest",
}

ROLE_PERMISSIONS = {
    "guest": ["view_public"],
    "student": ["view_public", "view_academy", "take_tests"],
    "pilot": [
        "view_public", "view_academy", "take_tests",
        "submit_plan", "cancel_own_plan",
        "view_own_history", "view_own_profile",
    ],
    "atc": [
        "view_public", "view_academy",
        "view_all_flights", "approve_plans", "reject_plans",
        "set_atis", "open_shift", "close_shift",
        "open_radio", "give_clearance",
    ],
    "instructor": [
        "view_public", "view_academy",
        "view_students", "approve_exams", "reject_exams", "write_notes",
    ],
    "moderator": [
        "view_public", "view_reports",
        "moderate_chat", "view_tickets", "answer_tickets",
    ],
    "admin": ["*"],
    "owner": ["*"],
}


def get_user_roles(session_user: dict) -> list[str]:
    if not session_user:
        return ["guest"]

    discord_roles = session_user.get("roles", [])
    site_roles = set()

    for role_name in discord_roles:
        if role_name in DISCORD_ROLES_MAP:
            site_roles.add(DISCORD_ROLES_MAP[role_name])

    if not site_roles:
        site_roles.add("guest")

    if "admin" in site_roles or "owner" in site_roles:
        return list(site_roles)

    return list(site_roles)


def has_permission(user_roles: list[str], permission: str) -> bool:
    for role in user_roles:
        perms = ROLE_PERMISSIONS.get(role, [])
        if "*" in perms or permission in perms:
            return True
    return False


async def require_permission(request: Request, permission: str):
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Не авторизован")
    roles = get_user_roles(user)
    if not has_permission(roles, permission):
        raise HTTPException(403, f"Нужно право: {permission}")
    return user