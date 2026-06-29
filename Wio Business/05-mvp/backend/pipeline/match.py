"""
Transaction matching: find an existing transaction that corresponds to an incoming receipt.

Matching criteria (all must pass):
  1. hasReceipt is False — don't match already-receipted transactions
  2. Amount within tolerance of extracted total (5% same-currency, 10% cross-currency)
  3. Date within ±3 calendar days
  4. Merchant name RapidFuzz similarity >= 0.70

FX conversion uses live rates from frankfurter.app (ECB-backed, no API key needed),
cached for 1 hour. Falls back to hardcoded rates on any network failure.
USD/AED is always 3.6725 (fixed currency board peg — API not consulted).

The first (best-scoring) match is returned. If no match, returns None and the
caller routes the receipt to the Approvals queue.
"""

from __future__ import annotations

import json
import re
import threading
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from rapidfuzz import fuzz


AMOUNT_TOLERANCE_SAME = 0.05   # ±5%  — same currency (rounding only)
AMOUNT_TOLERANCE_FX   = 0.10   # ±10% — cross-currency (live rate + bank spread 0.5–3%)
DATE_WINDOW_DAYS  = 3          # ±3 calendar days
MERCHANT_THRESHOLD = 0.70      # RapidFuzz token_sort_ratio >= 70

# Fallback rates used when the live fetch fails.
# USD is the fixed AED peg and is always used directly (never overridden by API).
_FALLBACK_RATES: dict[str, float] = {
    'USD': 3.6725,
    'EUR': 4.02,
    'GBP': 4.65,
    'SAR': 0.9793,
    'KWD': 11.97,
    'BHD': 9.74,
    'QAR': 1.008,
    'OMR': 9.54,
    'MYR': 0.83,
    'INR': 0.044,
    'SGD': 2.72,
    'CAD': 2.70,
    'AUD': 2.37,
}

_TRACKED = [c for c in _FALLBACK_RATES if c != 'USD']  # USD handled separately

_rate_cache: dict[str, float] = {}
_rate_cache_expiry: float = 0.0
_rate_lock = threading.Lock()
_CACHE_TTL = 3600  # 1 hour — rates update daily, no need to fetch more often


def _fetch_live_rates() -> dict[str, float]:
    """
    Fetch today's rates from frankfurter.app: AED → [all tracked currencies].
    Inverts each to get [currency] → AED. Returns empty dict on any error.
    Timeout is 3 s so a network hiccup never blocks the pipeline for long.
    """
    symbols = ",".join(_TRACKED)
    url = f"https://api.frankfurter.app/latest?from=AED&to={symbols}"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:  # noqa: S310
            data = json.loads(resp.read())
        aed_to_x: dict[str, float] = data.get("rates", {})
        return {
            currency: 1.0 / rate
            for currency, rate in aed_to_x.items()
            if rate > 0
        }
    except Exception:
        return {}


def _get_rates() -> dict[str, float]:
    """Return cached X→AED rates, refreshing if the 1-hour TTL has elapsed."""
    global _rate_cache, _rate_cache_expiry
    now = time.monotonic()
    with _rate_lock:
        if now < _rate_cache_expiry and _rate_cache:
            return _rate_cache
        live = _fetch_live_rates()
        rates = {**_FALLBACK_RATES, **live}
        rates["USD"] = 3.6725  # peg — never let the API override this
        _rate_cache = rates
        _rate_cache_expiry = now + _CACHE_TTL
        return rates


@dataclass
class MatchResult:
    transaction_id: str
    merchant: str
    amount: float
    date: str
    amount_diff_pct: float
    date_diff_days: int
    merchant_score: float


def _to_aed(amount: float, currency: str) -> float:
    """Convert any currency to AED using live-cached rates. Returns amount unchanged if unknown."""
    currency = currency.upper().strip()
    if currency == "AED":
        return amount
    rates = _get_rates()
    rate = rates.get(currency)
    return amount * rate if rate else amount


def find_match(
    extracted_merchant: str,
    extracted_total: float,
    extracted_date: str,
    transactions: list[dict],
    extracted_currency: str = 'AED',
) -> Optional[MatchResult]:
    """
    Find the best matching transaction from a list.

    transactions: list of dicts with keys:
        id, merchant, amount, date (YYYY-MM-DD), hasReceipt (bool), status
    """
    # Normalise extracted amount to AED for comparison against AED-denominated transactions
    extracted_aed = _to_aed(extracted_total, extracted_currency)

    extracted_dt = _parse_date(extracted_date)
    candidates: list[tuple[float, MatchResult]] = []

    for tx in transactions:
        # Skip already-receipted or non-approved transactions
        if tx.get("has_receipt"):
            continue
        if tx.get("status") not in ("approved", "pending_approval"):
            continue

        tx_amount = float(tx.get("amount") or 0)
        tx_currency = (tx.get("currency") or "AED").upper()
        tx_date = _parse_date(tx.get("date") or "")

        # Normalise tx amount to AED too (in case it was stored in foreign currency)
        tx_aed = _to_aed(tx_amount, tx_currency)

        # Amount gate — compare both sides in AED.
        # Use a wider tolerance for cross-currency matches to absorb bank FX spread (0.5–3%).
        if tx_aed <= 0 or extracted_aed <= 0:
            continue
        amount_diff = abs(tx_aed - extracted_aed) / max(tx_aed, extracted_aed)
        is_cross_currency = extracted_currency.upper() != tx_currency.upper()
        tolerance = AMOUNT_TOLERANCE_FX if is_cross_currency else AMOUNT_TOLERANCE_SAME
        if amount_diff > tolerance:
            continue

        # Date gate
        if extracted_dt is None or tx_date is None:
            date_diff = 0  # no date info → don't reject, just score 0
        else:
            date_diff = abs((extracted_dt - tx_date).days)
            if date_diff > DATE_WINDOW_DAYS:
                continue

        # Merchant similarity
        merchant_score = fuzz.token_sort_ratio(
            _normalize(extracted_merchant),
            _normalize(tx.get("merchant") or ""),
        ) / 100.0
        if merchant_score < MERCHANT_THRESHOLD:
            continue

        # Composite score: prioritise merchant similarity, then date proximity
        composite = merchant_score - (date_diff * 0.01) - (amount_diff * 0.5)
        candidates.append((
            composite,
            MatchResult(
                transaction_id=tx["id"],
                merchant=tx.get("merchant", ""),
                amount=tx_amount,
                date=tx.get("date", ""),
                amount_diff_pct=round(amount_diff * 100, 2),
                date_diff_days=date_diff,
                merchant_score=round(merchant_score, 3),
            ),
        ))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def _parse_date(date_str: str) -> Optional[datetime]:
    """Try common date formats."""
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
               "%Y/%m/%d", "%d/%m/%y", "%d-%m-%y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation for fuzzy comparison."""
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()
