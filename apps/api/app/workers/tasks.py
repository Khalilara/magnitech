"""Tâches asynchrones. Chaque tâche doit être idempotente (rejouable sans effet de bord)."""

from app.workers.celery_app import celery_app


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=8)
def process_webhook_event(self, webhook_event_id: str) -> None:
    """Dispatch selon provider/event_type :

    stripe  payment_intent.succeeded      → orders.payment_status = paid, création des commissions
    stripe  charge.refunded               → commissions.status = reversed (prorata)
    stripe  account.updated               → vendors.stripe_payouts_enabled
    stripe  transfer.reversed / failed    → payouts.status = failed
    carrier tracking.delivered            → shipments/vendor_orders delivered, commissions.payable_at
    carrier cod.remitted                  → shipments.cod_remitted_at, payments(provider='cod') = paid
    """
    raise NotImplementedError


@celery_app.task
def release_payable_commissions() -> None:
    """UPDATE commissions SET status='payable' WHERE status='pending' AND payable_at <= now()
    (+ pour le COD : uniquement si shipments.cod_remitted_at IS NOT NULL)."""
    raise NotImplementedError


@celery_app.task
def create_weekly_payouts() -> None:
    """Par vendeur actif avec stripe_payouts_enabled :
    1. SELECT … FOR UPDATE SKIP LOCKED des commissions 'payable'
    2. INSERT payouts (net = Σ vendor_net + ajustements)
    3. stripe.Transfer.create(amount=net, destination=acct, transfer_group=…,
       idempotency_key=f"payout-{payout.id}")
    4. commissions → 'paid', payout → 'processing' puis 'paid' via webhook."""
    raise NotImplementedError


@celery_app.task
def poll_carrier_tracking() -> None:
    raise NotImplementedError
