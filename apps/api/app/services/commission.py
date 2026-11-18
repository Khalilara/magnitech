"""Calcul des commissions Maghitech.

Règles :
  * Taux en points de base (bps) : 1200 = 12 %.
  * Priorité du taux : contrat vendeur > catégorie > défaut plateforme.
  * Le taux est figé sur l'order_item au moment de la commande.
  * Arrondi au centime "half-up" ; la part vendeur = assiette - commission
    (aucun centime ne se perd : commission + net == assiette).
  * Une commission devient "payable" après livraison + délai de rétractation.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

BPS_DENOMINATOR = 10_000


@dataclass(frozen=True, slots=True)
class CommissionSplit:
    base_amount_cents: int
    rate_bps: int
    commission_cents: int
    vendor_net_cents: int


def resolve_rate_bps(
    *, vendor_rate_bps: int | None, category_rate_bps: int | None, default_rate_bps: int
) -> int:
    for rate in (vendor_rate_bps, category_rate_bps):
        if rate is not None:
            return rate
    return default_rate_bps


def split(base_amount_cents: int, rate_bps: int) -> CommissionSplit:
    if base_amount_cents < 0:
        raise ValueError("base_amount_cents must be >= 0")
    if not 0 <= rate_bps <= BPS_DENOMINATOR:
        raise ValueError("rate_bps must be within [0, 10000]")
    commission = (base_amount_cents * rate_bps + BPS_DENOMINATOR // 2) // BPS_DENOMINATOR
    return CommissionSplit(
        base_amount_cents=base_amount_cents,
        rate_bps=rate_bps,
        commission_cents=commission,
        vendor_net_cents=base_amount_cents - commission,
    )


def payable_at(delivered_at: datetime, return_window_days: int = 14) -> datetime:
    """Date à partir de laquelle la commission peut être reversée."""
    return delivered_at + timedelta(days=return_window_days)
