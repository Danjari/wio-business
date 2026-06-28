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
from botocore.exceptions import ClientError


TEXTRACT_REGION = os.getenv("AWS_REGION", "me-south-1")
CONFIDENCE_THRESHOLD = float(os.getenv("TEXTRACT_CONFIDENCE_THRESHOLD", "80"))


@dataclass
class ExtractResult:
    merchant: Optional[str] = None
    total: Optional[float] = None
    total_raw: Optional[str] = None   # raw string before float parse
    date: Optional[str] = None
    raw_text: str = ""                # all detected text joined, used by LLM fallback
    textract_confidence: float = 0.0  # min confidence across detected key fields
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
    except FileNotFoundError as exc:
        raise RuntimeError(f"Image not found: {image_path}") from exc

    return _parse_response(response)


# ── Response parsing ──────────────────────────────────────────────────────────

# Textract field type names that map to merchant/vendor
_MERCHANT_FIELD_TYPES = {"VENDOR_NAME", "MERCHANT_NAME", "VENDOR", "RECEIVER_NAME"}
# Field types that represent the final total
_TOTAL_FIELD_TYPES = {"TOTAL", "AMOUNT_PAID", "SUBTOTAL"}
# Field types for date
_DATE_FIELD_TYPES = {"INVOICE_RECEIPT_DATE", "ORDER_DATE", "DUE_DATE"}


def _parse_response(response: dict) -> ExtractResult:
    result = ExtractResult(raw_response=response)
    confidences: list[float] = []
    text_parts: list[str] = []

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
                confidences.append(conf)

            elif field_type in _TOTAL_FIELD_TYPES and not result.total:
                result.total_raw = text
                result.total = _parse_amount(text)
                confidences.append(conf)

            elif field_type in _DATE_FIELD_TYPES and not result.date:
                result.date = text
                confidences.append(conf)

        # Collect raw text from line items too (useful for LLM fallback)
        for group in doc.get("LineItemGroups", []):
            for item in group.get("LineItems", []):
                for expense_field in item.get("LineItemExpenseFields", []):
                    val = (
                        expense_field.get("ValueDetection", {}).get("Text") or ""
                    ).strip()
                    if val:
                        text_parts.append(val)

    result.raw_text = " | ".join(text_parts)
    result.all_fields_present = all(
        [result.merchant, result.total is not None, result.date]
    )

    if confidences:
        result.textract_confidence = min(confidences)
    result.high_confidence = (
        result.all_fields_present
        and result.textract_confidence >= CONFIDENCE_THRESHOLD
    )

    return result


def _parse_amount(text: str) -> Optional[float]:
    """Strip currency symbols and parse to float."""
    # Remove known currency codes and symbols
    cleaned = re.sub(r"[^\d.,]", "", text.replace(",", "."))
    # If multiple dots, keep only the last (e.g. "1.234.56" → "123456" is wrong,
    # but "193.00" stays "193.00")
    parts = cleaned.split(".")
    if len(parts) > 2:
        # More than one decimal point — probably thousands separator used as dot
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None
