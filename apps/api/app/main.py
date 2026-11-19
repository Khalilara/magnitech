from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import auth, webhooks
from app.core.config import get_settings
from app.core.db import engine

settings = get_settings()

app = FastAPI(
    title="Magnitech API",
    version="0.1.0",
    docs_url=None if settings.app_env == "production" else "/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.cors_origins.split(",") if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router, prefix="/v1/webhooks", tags=["webhooks"])
app.include_router(auth.router, prefix="/v1/auth", tags=["authentication"])
app.include_router(auth.admin_router, prefix="/v1/admin", tags=["admin"])


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok"}
