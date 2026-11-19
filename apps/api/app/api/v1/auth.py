"""OAuth sign-in and opaque, revocable browser sessions."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db

router = APIRouter()
admin_router = APIRouter()
settings = get_settings()
limiter = Redis.from_url(settings.redis_url, decode_responses=True)
SESSION_COOKIE = "magnitech_session"
STATE_COOKIE = "magnitech_oauth_state"
VERIFIER_COOKIE = "magnitech_oauth_verifier"

PROVIDERS = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "profile": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "authorize": "https://github.com/login/oauth/authorize",
        "token": "https://github.com/login/oauth/access_token",
        "profile": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
    "microsoft": {
        "authorize": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "profile": "https://graph.microsoft.com/oidc/userinfo",
        "scope": "openid email profile",
    },
}


def _credentials(provider: str) -> tuple[str, str]:
    prefix = {"google": "google", "github": "github", "microsoft": "microsoft"}[provider]
    client_id = getattr(settings, f"{prefix}_client_id")
    client_secret = getattr(settings, f"{prefix}_client_secret")
    if not client_id or not client_secret:
        raise HTTPException(503, f"{provider.title()} sign-in is not configured")
    return client_id, client_secret


def _callback_url(request: Request, provider: str) -> str:
    return f"{settings.api_public_url.rstrip('/')}/v1/auth/{provider}/callback"


async def _rate_limit(request: Request, action: str, limit: int) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"auth-rate:{action}:{ip}"
    count = await limiter.incr(key)
    if count == 1:
        await limiter.expire(key, 60)
    if count > limit:
        raise HTTPException(429, "Too many sign-in attempts. Wait a minute and try again.")


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=settings.app_env == "production",
        samesite="lax", path="/", domain=settings.auth_cookie_domain or None,
    )


@router.get("/{provider}/start")
async def oauth_start(provider: str, request: Request):
    await _rate_limit(request, "start", 12)
    if provider not in PROVIDERS:
        raise HTTPException(404, "Unknown sign-in provider")
    client_id, _ = _credentials(provider)
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    challenge = hashlib.sha256(verifier.encode()).digest()
    import base64

    challenge_text = base64.urlsafe_b64encode(challenge).decode().rstrip("=")
    config = PROVIDERS[provider]
    params = {
        "client_id": client_id, "redirect_uri": _callback_url(request, provider),
        "response_type": "code", "scope": config["scope"], "state": state,
        "code_challenge": challenge_text, "code_challenge_method": "S256",
    }
    if provider == "google":
        params["access_type"] = "online"
    response = RedirectResponse(f"{config['authorize']}?{urlencode(params)}", status_code=302)
    _set_cookie(response, STATE_COOKIE, state, 600)
    _set_cookie(response, VERIFIER_COOKIE, verifier, 600)
    return response


async def _provider_profile(provider: str, access_token: str) -> tuple[str, str, str]:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=12) as client:
        profile_response = await client.get(PROVIDERS[provider]["profile"], headers=headers)
        profile_response.raise_for_status()
        profile = profile_response.json()
        if provider == "github":
            emails_response = await client.get("https://api.github.com/user/emails", headers=headers)
            emails_response.raise_for_status()
            verified = next((item for item in emails_response.json() if item.get("primary") and item.get("verified")), None)
            email = verified.get("email", "") if verified else ""
            provider_id = str(profile.get("id", ""))
            name = profile.get("name") or profile.get("login") or ""
        elif provider == "microsoft":
            email = profile.get("email", "")
            provider_id = str(profile.get("sub", ""))
            name = profile.get("name", "")
        else:
            email = profile.get("email", "") if profile.get("email_verified") else ""
            provider_id = str(profile.get("sub", ""))
            name = profile.get("name", "")
    if not email or not provider_id:
        raise HTTPException(400, "Provider did not return a verified email")
    return email.strip().lower(), provider_id, name


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str, request: Request, code: str = "", state: str = "",
    error: str = "", db: AsyncSession = Depends(get_db),  # noqa: B008
):
    await _rate_limit(request, "callback", 20)
    if provider not in PROVIDERS:
        raise HTTPException(404, "Unknown sign-in provider")
    if error or not code or not state or not secrets.compare_digest(state, request.cookies.get(STATE_COOKIE, "")):
        raise HTTPException(400, "Sign-in was cancelled or its security check failed")
    verifier = request.cookies.get(VERIFIER_COOKIE)
    if not verifier:
        raise HTTPException(400, "Sign-in expired. Please try again.")
    client_id, client_secret = _credentials(provider)
    config = PROVIDERS[provider]
    async with httpx.AsyncClient(timeout=12) as client:
        token_response = await client.post(config["token"], data={
            "client_id": client_id, "client_secret": client_secret, "code": code,
            "redirect_uri": _callback_url(request, provider), "grant_type": "authorization_code",
            "code_verifier": verifier,
        }, headers={"Accept": "application/json"})
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
    if not access_token:
        raise HTTPException(401, "The identity provider did not authorize sign-in")
    email, provider_id, name = await _provider_profile(provider, access_token)

    identity = (await db.execute(text("SELECT user_id FROM auth_identities WHERE provider=:p AND provider_user_id=:i"), {"p": provider, "i": provider_id})).first()
    if identity:
        user_id = identity.user_id
        user_row = (await db.execute(text("SELECT id, email, role, is_active FROM users WHERE id=:id"), {"id": user_id})).first()
        if not user_row or not user_row.is_active:
            raise HTTPException(403, "This account is disabled")
        if user_row.email.lower() != email:
            raise HTTPException(400, "Provider email changed; contact support")
        role = user_row.role
    else:
        # ADMIN_EMAIL is the only bootstrap path. Provider identity must return a verified email.
        role = "admin" if settings.admin_email and email == settings.admin_email.strip().lower() else "customer"
        parts = name.split(" ", 1)
        row = (await db.execute(text("""
            INSERT INTO users(email, first_name, last_name, role, email_verified_at, last_login_at)
            VALUES (:email, :first, :last, CAST(:role AS user_role), now(), now())
            ON CONFLICT (email) DO UPDATE SET last_login_at=now()
            RETURNING id, role, is_active
        """), {"email": email, "first": parts[0] if parts else "", "last": parts[1] if len(parts) > 1 else "", "role": role})).first()
        if not row or not row.is_active:
            raise HTTPException(403, "This account is disabled")
        user_id, role = row.id, row.role
        await db.execute(text("""INSERT INTO auth_identities(user_id, provider, provider_user_id)
            VALUES (:uid, :p, :pid) ON CONFLICT (provider, provider_user_id) DO NOTHING"""),
            {"uid": user_id, "p": provider, "pid": provider_id})

    raw_session = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_session.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=settings.session_ttl_days)
    await db.execute(text("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (:hash,:uid,:exp)"), {"hash": token_hash, "uid": user_id, "exp": expires_at})
    await db.commit()
    target = settings.dashboard_url if role == "admin" else settings.storefront_url
    response = RedirectResponse(target, status_code=303)
    _set_cookie(response, SESSION_COOKIE, raw_session, settings.session_ttl_days * 86400)
    response.delete_cookie(STATE_COOKIE, path="/", domain=settings.auth_cookie_domain or None)
    response.delete_cookie(VERIFIER_COOKIE, path="/", domain=settings.auth_cookie_domain or None)
    return response


async def current_user(request: Request, db: AsyncSession = Depends(get_db)):  # noqa: B008
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "Authentication required")
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = (await db.execute(text("""SELECT u.id, u.email, u.role FROM auth_sessions s
        JOIN users u ON u.id=s.user_id WHERE s.token_hash=:hash AND s.expires_at>now() AND u.is_active"""), {"hash": token_hash})).first()
    if not row:
        raise HTTPException(401, "Session expired")
    return row


@router.get("/session")
async def session(user=Depends(current_user)):  # noqa: B008
    return {"id": str(user.id), "email": user.email, "role": user.role}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):  # noqa: B008
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        digest = hashlib.sha256(token.encode()).hexdigest()
        await db.execute(text("DELETE FROM auth_sessions WHERE token_hash=:hash"), {"hash": digest})
        await db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", domain=settings.auth_cookie_domain or None)
    return {"ok": True}


async def require_admin(user=Depends(current_user)):  # noqa: B008
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return user


@admin_router.get("/session")
async def protected_admin_session(user=Depends(require_admin)):  # noqa: B008
    """Protected admin API probe; apply require_admin to every future admin route."""
    return {"id": str(user.id), "email": user.email, "role": user.role}
