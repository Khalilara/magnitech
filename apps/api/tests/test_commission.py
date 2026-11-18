from datetime import datetime, timezone

import pytest

from app.services.commission import payable_at, resolve_rate_bps, split


def test_split_never_loses_a_cent():
    for base in (0, 1, 99, 1999, 4_999_99):
        for rate in (0, 1, 850, 1200, 1250, 10_000):
            s = split(base, rate)
            assert s.commission_cents + s.vendor_net_cents == base


def test_split_half_up():
    assert split(1999, 1250).commission_cents == 250   # 249.875 → 250
    assert split(100, 1250).commission_cents == 13     # 12.5 → 13


def test_rate_priority():
    assert resolve_rate_bps(vendor_rate_bps=800, category_rate_bps=1500, default_rate_bps=1200) == 800
    assert resolve_rate_bps(vendor_rate_bps=None, category_rate_bps=1500, default_rate_bps=1200) == 1500
    assert resolve_rate_bps(vendor_rate_bps=None, category_rate_bps=None, default_rate_bps=1200) == 1200


def test_invalid_rate():
    with pytest.raises(ValueError):
        split(1000, 10_001)


def test_payable_at():
    d = datetime(2026, 11, 1, tzinfo=timezone.utc)
    assert payable_at(d).day == 15
