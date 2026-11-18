from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "maghitech",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    timezone="Europe/Paris",
    task_acks_late=True,                 # pas de perte si un worker meurt en cours de tâche
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_default_queue="default",
    task_routes={
        "app.workers.tasks.process_webhook_event": {"queue": "webhooks"},
        "app.workers.tasks.release_payable_commissions": {"queue": "payouts"},
        "app.workers.tasks.create_weekly_payouts": {"queue": "payouts"},
        "app.workers.tasks.poll_carrier_tracking": {"queue": "orders"},
    },
    beat_schedule={
        # pending → payable quand livraison + 14 j est dépassé
        "release-commissions": {
            "task": "app.workers.tasks.release_payable_commissions",
            "schedule": crontab(minute=5),
        },
        # Reversement hebdomadaire aux vendeurs (Stripe Connect transfers)
        "weekly-payouts": {
            "task": "app.workers.tasks.create_weekly_payouts",
            "schedule": crontab(hour=6, minute=0, day_of_week="mon"),
        },
        # Transporteurs sans webhook (ex. API Suivi La Poste)
        "poll-tracking": {
            "task": "app.workers.tasks.poll_carrier_tracking",
            "schedule": crontab(minute="*/30"),
        },
    },
)
