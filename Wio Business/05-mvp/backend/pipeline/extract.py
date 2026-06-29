"""
AWS Textract receipt extraction.

Calls AnalyzeExpense (receipt mode) on a local image file.
Returns an ExtractResult with merchant, total, date and per-field confidence.

Regulatory note: the caller is responsible for deleting the image file after
this function returns. This module never stores or transmits the image beyond
the Textract API call.

Data residency: configure AWS_REGION=me-south-1 (Bahrain) to keep data within
the Gulf region. Production deployments should confirm Textract is available in
that region and review CBUAE data localization requirements.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Optional

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, BotoCoreError


TEXTRACT_REGION = os.getenv("AWS_REGION", "me-south-1")
CONFIDENCE_THRESHOLD = float(os.getenv("TEXTRACT_CONFIDENCE_THRESHOLD", "80"))


@dataclass
class ExtractResult:
    merchant: Optional[str] = None
    total: Optional[float] = None
    total_raw: Optional[str] = None   # raw string before float parse
    currency: Optional[str] = None    # ISO code detected from total symbol
    date: Optional[str] = None
    raw_text: str = ""                # all detected text joined, used by LLM fallback
    line_items: list = field(default_factory=list)  # ITEM-type descriptions for categorization
    # Per-field confidence scores (0–100, Textract scale)
    total_confidence: float = 0.0
    merchant_confidence: float = 0.0
    date_confidence: float = 0.0
    # Aggregate: min across found fields; forced to 0 if total missing (total-first gating)
    textract_confidence: float = 0.0
    all_fields_present: bool = False  # True when merchant+total+date all found
    high_confidence: bool = False     # True when present AND confidence >= threshold
    raw_response: dict = field(default_factory=dict, repr=False)
    error: Optional[str] = None


def extract_receipt(image_path: str) -> ExtractResult:
    """
    Run AWS Textract AnalyzeExpense on a local image file.
    Raises RuntimeError on API error so the caller can handle fallback.
    """
    client = boto3.client("textract", region_name=TEXTRACT_REGION)

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        response = client.analyze_expense(Document={"Bytes": image_bytes})
    except ClientError as exc:
        raise RuntimeError(f"Textract API error: {exc}") from exc
    except EndpointConnectionError as exc:
        raise RuntimeError(f"Textract unreachable (network/DNS): {exc}") from exc
    except BotoCoreError as exc:
        raise RuntimeError(f"Textract botocore error: {exc}") from exc
    except FileNotFoundError as exc:
        raise RuntimeError(f"Image not found: {image_path}") from exc

    return _parse_response(response)


# ── Response parsing ──────────────────────────────────────────────────────────

# Merchant field types
_MERCHANT_FIELD_TYPES = {"VENDOR_NAME", "MERCHANT_NAME", "VENDOR", "RECEIVER_NAME"}

# Priority order for total extraction (cascading fallback within parse_textract_response):
# 1. TOTAL — the explicit bottom-line total (most reliable)
# 2. AMOUNT_DUE — amount owed on invoices; equivalent to total
# 3. AMOUNT_PAID — last resort only when 1+2 both absent; on some receipts this
#    equals the total (exact-payment B2B transactions), but on cash retail receipts
#    it's the cash tendered and may be higher than the actual total
_TOTAL_PRIMARY   = {"TOTAL"}
_TOTAL_SECONDARY = {"AMOUNT_DUE"}
_TOTAL_FALLBACK  = {"AMOUNT_PAID"}

# Date field types
_DATE_FIELD_TYPES = {"INVOICE_RECEIPT_DATE", "ORDER_DATE", "DUE_DATE"}


def parse_textract_response(response: dict) -> ExtractResult:
    """
    Parse a raw Textract AnalyzeExpense response dict into an ExtractResult.

    Public so the benchmark can cache raw API responses and re-parse locally
    whenever the parsing logic changes — no new API calls needed.
    """
    result = ExtractResult(raw_response=response)
    text_parts: list[str] = []

    # Per-field confidence accumulators (kept separate for routing decisions)
    merchant_conf: float = 0.0
    date_conf: float = 0.0

    # Cascading total candidates: primary → secondary → fallback.
    # Collected separately so we only use a lower-priority tier when higher tiers
    # return nothing. Within each tier, take the largest value (final total ≥ subtotals).
    primary_candidates:   list[tuple[float, float, str]] = []
    secondary_candidates: list[tuple[float, float, str]] = []
    fallback_candidates:  list[tuple[float, float, str]] = []

    for doc in response.get("ExpenseDocuments", []):
        for summary_field in doc.get("SummaryFields", []):
            field_type = summary_field.get("Type", {}).get("Text", "").upper()
            value_detection = summary_field.get("ValueDetection", {})
            text = (value_detection.get("Text") or "").strip()
            conf = float(value_detection.get("Confidence") or 0.0)

            if not text:
                continue

            text_parts.append(f"{field_type}: {text}")

            if field_type in _MERCHANT_FIELD_TYPES and not result.merchant:
                result.merchant = text
                merchant_conf = conf

            elif field_type in _DATE_FIELD_TYPES and not result.date:
                result.date = text
                date_conf = conf

            else:
                amt = _parse_amount(text)
                if amt is not None and amt > 0:
                    if field_type in _TOTAL_PRIMARY:
                        primary_candidates.append((amt, conf, text))
                    elif field_type in _TOTAL_SECONDARY:
                        secondary_candidates.append((amt, conf, text))
                    elif field_type in _TOTAL_FALLBACK:
                        fallback_candidates.append((amt, conf, text))

        for group in doc.get("LineItemGroups", []):
            for item in group.get("LineItems", []):
                item_desc: Optional[str] = None
                for expense_field in item.get("LineItemExpenseFields", []):
                    ftype = expense_field.get("Type", {}).get("Text", "").upper()
                    val = (expense_field.get("ValueDetection", {}).get("Text") or "").strip()
                    if not val:
                        continue
                    text_parts.append(val)
                    # Capture ITEM descriptions separately for categorization context
                    if ftype == "ITEM" and item_desc is None:
                        item_desc = val
                if item_desc:
                    result.line_items.append(item_desc)

    # Use the highest-priority tier that returned candidates
    total_conf: float = 0.0
    total_candidates = primary_candidates or secondary_candidates or fallback_candidates
    if total_candidates:
        best_amt, best_conf, best_raw = max(total_candidates, key=lambda x: x[0])
        result.total = best_amt
        result.total_raw = best_raw
        result.currency = _detect_currency(best_raw)
        total_conf = best_conf

    # Store per-field confidence scores
    result.total_confidence = total_conf
    result.merchant_confidence = merchant_conf
    result.date_confidence = date_conf

    result.raw_text = " | ".join(text_parts)
    result.all_fields_present = all([result.merchant, result.total is not None, result.date])

    # Total-first gating: if the total is missing, aggregate confidence is zero regardless
    # of how confident we are about merchant/date — a receipt without a total is useless
    # for reconciliation and must route to LLM fallback unconditionally.
    if result.total is None:
        result.textract_confidence = 0.0
    else:
        found_confs = [c for c in [total_conf, merchant_conf if result.merchant else None,
                                   date_conf if result.date else None] if c is not None]
        result.textract_confidence = min(found_confs) if found_confs else 0.0

    result.high_confidence = (
        result.all_fields_present and result.textract_confidence >= CONFIDENCE_THRESHOLD
    )

    return result


# Keep private alias so internal callers don't need updating
_parse_response = parse_textract_response


_CURRENCY_MAP = {
    # Compound symbols MUST come before their substrings — iteration stops on first match.
    # e.g. "ca$" must appear before "$" or "ca$19.99" incorrectly resolves to USD.
    "us$": "USD", "usd": "USD",
    "ca$": "CAD", "cad": "CAD",
    "s$": "SGD",  "sgd": "SGD",
    "hk$": "HKD", "hkd": "HKD",
    "a$": "AUD",  "aud": "AUD",
    "nz$": "NZD", "nzd": "NZD",
    "rm": "MYR",  "myr": "MYR",
    "₹": "INR",   "inr": "INR",
    "aed": "AED", "د.إ": "AED", "dhs": "AED", "dirham": "AED",
    "£": "GBP",   "gbp": "GBP",
    "€": "EUR",   "eur": "EUR",
    "sar": "SAR", "﷼": "SAR",
    "qar": "QAR", "kwd": "KWD", "bhd": "BHD", "omr": "OMR",
    "$": "USD",   # bare $ last — only matches if no compound symbol matched above
}


def _detect_currency(text: str) -> Optional[str]:
    """Detect ISO currency code from a raw amount string like '$5.99' or 'AED 193.00'."""
    lower = text.lower().strip()
    for symbol, code in _CURRENCY_MAP.items():
        if symbol in lower:
            return code
    return None


def _parse_amount(text: str) -> Optional[float]:
    """Strip currency symbols and parse to float."""
    t = text.strip()
    # "10 00" → "10.00": OCR sometimes reads a faint decimal point as a space.
    # Pattern: digits, a space, exactly 1-2 digits at end of string.
    t = re.sub(r"(\d+)\s(\d{1,2})$", r"\1.\2", t)
    cleaned = re.sub(r"[^\d.,]", "", t.replace(",", "."))
    parts = cleaned.split(".")
    if len(parts) > 2:
        # Multiple dots → thousands separator; keep only last segment as decimals
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None
