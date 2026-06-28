"""
Shared accuracy and agreement computations for both benchmark scripts.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Optional


# ── Extraction accuracy ───────────────────────────────────────────────────────

def extraction_accuracy(
    predictions: list[dict],
    ground_truth: list[dict],
) -> dict:
    """
    Compare extracted fields to gdt ground truth.

    predictions: list of {'merchant': str|None, 'date': str|None, 'total': float|None}
    ground_truth: list of {'company': str, 'date': str, 'total': str} (from gdt/*.json)

    Returns a dict of percentage metrics.
    """
    n = len(ground_truth)
    assert len(predictions) == n, "predictions and ground_truth must have same length"

    company_exact = company_partial = date_exact = 0
    total_exact = total_near = total_extracted = 0

    for pred, gt in zip(predictions, ground_truth):
        pred_company = (pred.get("merchant") or "").upper().strip()
        gt_company = (gt.get("company") or "").upper().strip()

        if pred_company and gt_company:
            if pred_company == gt_company:
                company_exact += 1
            elif pred_company in gt_company or gt_company in pred_company:
                company_partial += 1

        pred_date = normalize_date(pred.get("date") or "")
        gt_date = normalize_date(gt.get("date") or "")
        if pred_date and gt_date and pred_date == gt_date:
            date_exact += 1

        pred_total = pred.get("total")
        gt_total = parse_amount(gt.get("total") or "")
        if pred_total is not None and gt_total is not None and gt_total > 0:
            total_extracted += 1
            diff = abs(pred_total - gt_total)
            if diff < 0.01:
                total_exact += 1
            elif diff / gt_total <= 0.01:
                total_near += 1

    return {
        "n": n,
        "company_exact_pct": _pct(company_exact, n),
        "company_partial_or_exact_pct": _pct(company_exact + company_partial, n),
        "date_exact_pct": _pct(date_exact, n),
        "total_extracted_pct": _pct(total_extracted, n),
        "total_exact_pct": _pct(total_exact, total_extracted) if total_extracted else 0.0,
        "total_within_1pct_pct": _pct(total_exact + total_near, total_extracted) if total_extracted else 0.0,
    }


# ── Categorization agreement ──────────────────────────────────────────────────

def categorization_agreement(
    llm_results: list[str],
    rules_results: list[str],
    merchants: list[str],
    sample_size: int = 50,
) -> dict:
    """
    Agreement analysis between two categorization methods.
    No ground truth required — measures how often they agree.
    """
    n = len(llm_results)
    assert len(rules_results) == n and len(merchants) == n

    agreements = sum(1 for a, b in zip(llm_results, rules_results) if a == b)

    disagreements = [
        {"merchant": merchants[i], "llm": llm_results[i], "rules": rules_results[i]}
        for i in range(n)
        if llm_results[i] != rules_results[i]
    ]

    # Random sample for manual review
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

def normalize_date(date_str: str) -> str:
    """Normalise common date formats to YYYY-MM-DD for comparison."""
    s = date_str.strip()

    # DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (and short year variants)
    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", s)
    if m:
        d, mo, y = m.groups()
        if len(y) == 2:
            y = "20" + y
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

    # YYYY/MM/DD or YYYY-MM-DD already
    m = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

    return s


def parse_amount(text: str) -> Optional[float]:
    """Strip currency symbols/letters and parse to float."""
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", "."))
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _pct(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0
