"""Operator-only maintenance commands (run inside the trusted API environment)."""
import asyncio
import sys

from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import SessionLocal


async def provision_admin() -> None:
    configured = get_settings().admin_email.strip().lower()
    if not configured:
        raise SystemExit("Set ADMIN_EMAIL before provisioning the owner account.")
    async with SessionLocal() as db:
        await db.execute(text("""
            INSERT INTO users(email, role, email_verified_at)
            VALUES (:email, 'admin'::user_role, now())
            ON CONFLICT (email) DO UPDATE SET role='admin'::user_role
        """), {"email": configured})
        await db.commit()
    print(f"Admin role provisioned for configured ADMIN_EMAIL: {configured}")


if __name__ == "__main__":
    if sys.argv[1:] != ["provision-admin"]:
        raise SystemExit("Usage: python -m app.cli provision-admin")
    asyncio.run(provision_admin())
