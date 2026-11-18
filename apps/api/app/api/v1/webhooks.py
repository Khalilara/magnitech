"""Webhooks entrants : Stripe + transporteurs.

Principe : vérifier la signature → enregistrer l'événement (idempotent)
→ répondre 200 immédiatement → traitement asynchrone par Celery.
"""

import hashlib
import hmac
import json

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.workers.tasks import process_webhook_event

router = APIRouter()
settings = get_settings()


async def _store_event(
    db: AsyncSession, provider: str, event_id: str, event_type: str, payload: dict
) -> str | None:
    """Insère l'événement ; renvoie None s'il a déjà été reçu (rejeu)."""
    result = await db.execute(
        text(
            """
            INSERT INTO webhook_events (provider, event_id, event_type, payload)
            VALUES (:provider, :event_id, :event_type, CAST(:payload AS jsonb))
            ON CONFLICT (provider, event_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "provider": provider,
            "event_id": event_id,
            "event_type": event_type,
            "payload": json.dumps(payload),
        },
    )
    row_id = result.scalar_one_or_none()
    await db.commit()
    return str(row_id) if row_id else None


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(body, stripe_signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="invalid signature") from exc

    stored_id = await _store_event(db, "stripe", event["id"], event["type"], json.loads(body))
    if stored_id:
        process_webhook_event.delay(stored_id)
    return {"received": True}


@router.post("/carriers/{carrier}")
async def carrier_webhook(
    carrier: str,
    request: Request,
    signature: str = Header(alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Webhook générique transporteur / agrégateur (Sendcloud, Boxtal…).

    Chaque adaptateur peut surcharger le nom d'en-tête et le format ; ici HMAC-SHA256 du corps.
    """
    secret = settings.carrier_secrets.get(carrier)
    if not secret:
        raise HTTPException(status_code=404, detail="unknown carrier")

    body = await request.body()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    payload = json.loads(body)
    event_id = str(payload.get("id") or hashlib.sha256(body).hexdigest())
    event_type = str(payload.get("action") or payload.get("type") or "tracking.update")

    stored_id = await _store_event(db, carrier, event_id, event_type, payload)
    if stored_id:
        process_webhook_event.delay(stored_id)
    return {"received": True}
