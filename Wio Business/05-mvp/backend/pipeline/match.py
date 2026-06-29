"""
Transaction matching: find an existing transaction that corresponds to an incoming receipt.

Matching criteria (all must pass):
  1. has_receipt is False — don't match already-receipted transactions
  2. Amount within ±5% tolerance (no currency conversion — amounts compared as-is)
  3. Date within ±3 calendar days
  4. Merchant name RapidFuzz similarity >= 0.70

The first (best-scoring) match is returned. If no match, returns None and the
caller routes the receipt to the Approvals queue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from rapidfuzz import fuzz


AMOUNT_TOLERANCE = 0.05   # ±5% — covers rounding and minor OCR drift
DATE_WINDOW_DAYS  = 3     # ±3 calendar days
MERCHANT_THRESHOLD = 0.70 # RapidFuzz token_sort_ratio >= 70


@dataclass
class MatchResult:
    transaction_id: str
    merchant: str
    amount: float
    date: str
    amount_diff_pct: float
    date_diff_days: int
    merchant_score: float


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
        id, merchant, amount, date (YYYY-MM-DD), has_receipt (bool), status
    Amounts are compared as-is (no currency conversion).
    """
    extracted_dt = _parse_date(extracted_date)
    candidates: list[tuple[float, MatchResult]] = []

    for tx in transactions:
        if tx.get("has_receipt"):
            continue
        if tx.get("status") not in ("approved", "pending_approval"):
            continue

        tx_amount = float(tx.get("amount") or 0)
        tx_date = _parse_date(tx.get("date") or "")

        if tx_amount <= 0 or extracted_total <= 0:
            continue

        # Amount gate — compare directly, no FX conversion
        amount_diff = abs(tx_amount - extracted_total) / max(tx_amount, extracted_total)
        if amount_diff > AMOUNT_TOLERANCE:
            continue

        # Date gate
        if extracted_dt is None or tx_date is None:
            date_diff = 0  # no date info → don't reject on date, score 0
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
