"""
Shared accuracy and agreement computations for both benchmark scripts.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Optional

try:
    from rapidfuzz import fuzz as _fuzz
    def fuzzy_match(a: str, b: str) -> float:
        return float(_fuzz.token_sort_ratio(a.upper(), b.upper()))
except ImportError:
    def fuzzy_match(a: str, b: str) -> float:
        a, b = a.upper().strip(), b.upper().strip()
        if a == b:
            return 100.0
        if a in b or b in a:
            return 75.0
        return 0.0

FUZZY_THRESHOLD = 80.0

# Confidence buckets: (low_inclusive, high_exclusive)
CONFIDENCE_BUCKETS = [(0, 50), (50, 70), (70, 80), (80, 90), (90, 95), (95, 99), (99, 101)]
BUCKET_LABELS =      ["0–50",  "50–70", "70–80", "80–90", "90–95", "95–99", "99–100"]
THRESHOLD_VALUES = [70, 75, 80, 85, 90, 95]


# ── Extraction accuracy ───────────────────────────────────────────────────────

def extraction_accuracy(
    predictions: list[dict],
    ground_truth: list[dict],
    ids: list[str] | None = None,
) -> dict:
    """
    Comprehensive extraction accuracy analysis.

    predictions:  list of ExtractResult serialised as dict
    ground_truth: list of gdt dicts {company, date, total, ...}
    ids:          optional list of receipt IDs for worst-failure tracking

    Returns a flat dict of scalar metrics + structured sub-tables.
    """
    n = len(ground_truth)
    assert len(predictions) == n, "predictions and ground_truth must have same length"
    ids = ids or [str(i) for i in range(n)]

    # Field counters
    merch_extracted = merch_exact = merch_fuzzy = 0
    date_extracted = date_exact = 0
    total_extracted = total_exact = total_near = 0
    all_three_correct = 0

    # Total error sub-types (denominator = total_extracted)
    err_factor10 = 0     # extracted ~10× off (decimal point slip)
    err_large = 0        # extracted >10% off but not factor-10
    err_small = 0        # extracted 1–10% off (within 10% but not "near")

    # Confidence bucket accumulators
    b_count   = [0] * len(CONFIDENCE_BUCKETS)
    b_t_exact = [0] * len(CONFIDENCE_BUCKETS)

    # Threshold accumulators
    th_data = {t: {"n_high": 0, "t_exact": 0} for t in THRESHOLD_VALUES}

    # Per-receipt enriched rows (for worst-failure list)
    per_receipt: list[dict] = []

    # Threshold accumulators for total_confidence-based routing (new, field-specific)
    th_total_data = {t: {"n_high": 0, "t_exact": 0} for t in THRESHOLD_VALUES}

    for pred, gt, rid in zip(predictions, ground_truth, ids):
        conf = float(pred.get("textract_confidence") or 0.0)
        total_conf = float(pred.get("total_confidence") or 0.0)

        # ── Merchant ──
        pred_m = (pred.get("merchant") or "").strip()
        gt_m   = (gt.get("company") or "").strip()
        m_ok   = False
        if pred_m:
            merch_extracted += 1
        if pred_m and gt_m:
            if pred_m.upper() == gt_m.upper():
                merch_exact += 1
                merch_fuzzy += 1
                m_ok = True
            else:
                score = fuzzy_match(pred_m, gt_m)
                if score >= FUZZY_THRESHOLD:
                    merch_fuzzy += 1
                    m_ok = True

        # ── Date ──
        pred_d = normalize_date(pred.get("date") or "")
        gt_d   = normalize_date(gt.get("date") or "")
        d_ok   = bool(pred_d and gt_d and pred_d == gt_d)
        if pred.get("date"):
            date_extracted += 1
        if d_ok:
            date_exact += 1

        # ── Total ──
        pred_t = pred.get("total")
        gt_t   = parse_amount(gt.get("total") or "")
        t_ok   = False
        t_near = False
        delta_pct: float | None = None

        if pred_t is not None and gt_t is not None and gt_t > 0:
            total_extracted += 1
            diff = abs(pred_t - gt_t)
            delta_pct = diff / gt_t * 100.0

            if diff < 0.01:
                total_exact += 1
                t_ok = True
            elif delta_pct <= 1.0:
                total_near += 1
                t_near = True
            else:
                # Error classification
                ratio = pred_t / gt_t
                if 8.0 <= ratio <= 12.0 or 0.083 <= ratio <= 0.125:
                    err_factor10 += 1
                elif delta_pct <= 10.0:
                    err_small += 1
                else:
                    err_large += 1

        # ── All three ──
        if t_ok and d_ok and m_ok:
            all_three_correct += 1

        # ── Confidence bucket ──
        bi = _bucket_index(conf)
        b_count[bi] += 1
        if t_ok:
            b_t_exact[bi] += 1

        # ── Threshold analysis ──
        for t in THRESHOLD_VALUES:
            if conf >= t:
                th_data[t]["n_high"] += 1
                if t_ok:
                    th_data[t]["t_exact"] += 1
            # total_confidence-based routing (new: matches orchestrate.py logic)
            if total_conf >= t:
                th_total_data[t]["n_high"] += 1
                if t_ok:
                    th_total_data[t]["t_exact"] += 1

        per_receipt.append({
            "id": rid,
            "conf": conf,
            "pred_merchant": pred_m,
            "pred_total": pred_t,
            "pred_date": pred.get("date"),
            "gt_merchant": gt_m,
            "gt_total": gt_t,
            "gt_date": gt.get("date"),
            "m_ok": m_ok,
            "d_ok": d_ok,
            "t_ok": t_ok,
            "t_near": t_near,
            "delta_pct": delta_pct,
        })

    # Build confidence bucket table
    confidence_buckets = [
        {
            "label": BUCKET_LABELS[i],
            "count": b_count[i],
            "pct_of_all": _pct(b_count[i], n),
            "total_accuracy": _pct(b_t_exact[i], b_count[i]) if b_count[i] else 0.0,
        }
        for i in range(len(CONFIDENCE_BUCKETS))
    ]

    # Build threshold analysis table (two routing strategies side-by-side)
    threshold_analysis = []
    for t in THRESHOLD_VALUES:
        n_high = th_data[t]["n_high"]
        n_low  = n - n_high
        # total_confidence-based (new field-specific routing)
        nt_high = th_total_data[t]["n_high"]
        nt_low  = n - nt_high
        threshold_analysis.append({
            "threshold": t,
            # aggregate-confidence routing (legacy)
            "n_high": n_high,
            "pct_high": _pct(n_high, n),
            "total_accuracy_high": _pct(th_data[t]["t_exact"], n_high) if n_high else 0.0,
            "n_low": n_low,
            "pct_low": _pct(n_low, n),
            # total_confidence routing (new)
            "nt_high": nt_high,
            "pct_t_high": _pct(nt_high, n),
            "total_accuracy_t_high": _pct(th_total_data[t]["t_exact"], nt_high) if nt_high else 0.0,
            "nt_low": nt_low,
            "pct_t_low": _pct(nt_low, n),
        })

    # Worst failures: high confidence but wrong total (not exact, not near)
    worst_failures = sorted(
        [
            r for r in per_receipt
            if r["conf"] >= 70
            and r["pred_total"] is not None
            and not r["t_ok"]
            and not r["t_near"]
        ],
        key=lambda r: -r["conf"],
    )[:20]

    return {
        "n": n,
        # Merchant
        "merchant_extracted_pct":    _pct(merch_extracted, n),
        "merchant_exact_pct":        _pct(merch_exact, n),
        "merchant_fuzzy_pct":        _pct(merch_fuzzy, n),
        # Date
        "date_extracted_pct":        _pct(date_extracted, n),
        "date_exact_pct":            _pct(date_exact, n),
        # Total (denominator = n for all, extracted for *_of_extracted)
        "total_extracted_pct":       _pct(total_extracted, n),
        "total_exact_pct":           _pct(total_exact, n),
        "total_exact_of_extracted":  _pct(total_exact, total_extracted) if total_extracted else 0.0,
        "total_within1pct_pct":      _pct(total_exact + total_near, n),
        # Total error breakdown (of total_extracted)
        "total_n_extracted":         total_extracted,
        "total_n_exact":             total_exact,
        "total_n_near":              total_near,
        "total_n_factor10_err":      err_factor10,
        "total_n_large_err":         err_large,
        "total_n_small_err":         err_small,
        "total_n_not_extracted":     n - total_extracted,
        # Combined
        "all_three_correct_pct":     _pct(all_three_correct, n),
        # Structured tables
        "confidence_buckets":        confidence_buckets,
        "threshold_analysis":        threshold_analysis,
        "worst_failures":            worst_failures,
        "per_receipt":               per_receipt,
    }


# ── Categorization agreement ──────────────────────────────────────────────────

def categorization_agreement(
    llm_results: list[str],
    rules_results: list[str],
    merchants: list[str],
    sample_size: int = 50,
) -> dict:
    n = len(llm_results)
    assert len(rules_results) == n and len(merchants) == n

    agreements = sum(1 for a, b in zip(llm_results, rules_results) if a == b)
    disagreements = [
        {"merchant": merchants[i], "llm": llm_results[i], "rules": rules_results[i]}
        for i in range(n) if llm_results[i] != rules_results[i]
    ]
    import random
    sample = random.sample(disagreements, min(sample_size, len(disagreements)))

    return {
        "n": n,
        "agreement": agreements,
        "agreement_pct": _pct(agreements, n),
        "disagreements": len(disagreements),
        "disagreement_pct": _pct(len(disagreements), n),
        "llm_distribution": dict(Counter(llm_results).most_common()),
        "rules_distribution": dict(Counter(rules_results).most_common()),
        "disagreement_sample": sample,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

_MONTH_NAMES = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def normalize_date(date_str: str) -> str:
    """Normalise common date formats to YYYY-MM-DD."""
    s = date_str.strip()

    # "22 Mar 18", "07 Mar 2018", "22 MAR 18" — text month, case-insensitive
    m = re.match(r"^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{2,4})$", s)
    if m:
        d, mon, y = m.groups()
        mo = _MONTH_NAMES.get(mon.lower())
        if mo:
            if len(y) == 2:
                y = "20" + y
            return f"{y}-{mo}-{d.zfill(2)}"

    # DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (Malaysia standard)
    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", s)
    if m:
        d, mo, y = m.groups()
        if len(y) == 2:
            y = "20" + y
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

    # YYYY-MM-DD or YYYY/MM/DD
    m = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

    return s


def parse_amount(text: str) -> Optional[float]:
    """Strip currency symbols and parse to float."""
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", "."))
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _bucket_index(conf: float) -> int:
    for i, (lo, hi) in enumerate(CONFIDENCE_BUCKETS):
        if lo <= conf < hi:
            return i
    return len(CONFIDENCE_BUCKETS) - 1


def _pct(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0
