"""
Claude Haiku text-only fallback for Textract extractions with missing or low-confidence fields.

This module receives the raw text output from Textract (which contains all detected text
even when structured fields weren't parsed) and asks Claude Haiku to extract the
merchant, total, and date from it.

No image is sent — only the text. This is cheaper than vision and stays compliant
with data minimization principles.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

import anthropic

_SYSTEM = """You are an expense receipt data extractor.
Given raw OCR text from a receipt, extract the merchant name, total amount paid, and date.

Return ONLY valid JSON with this shape:
{
  "merchant": "<business name or null>",
  "total": <number or null>,
  "date": "<date string as it appears on the receipt, or null>",
  "confidence": <0.0-1.0>
}

Rules:
- merchant: the business/vendor name, not a customer name
- total: the final total amount (numeric, no currency symbols)
- date: the transaction/receipt date (not expiry dates)
- confidence: set below 0.99 if any field is ambiguous, missing, or the text is garbled
- Use null for any field you cannot confidently determine"""


@dataclass
class LLMTextResult:
    merchant: Optional[str] = None
    total: Optional[float] = None
    date: Optional[str] = None
    confidence: float = 0.0
    raw_response: str = ""


def extract_from_text(raw_text: str) -> LLMTextResult:
    """
    Extract receipt fields from raw OCR text using Claude Haiku.
    Raises RuntimeError on API error.
    """
    if not raw_text.strip():
        return LLMTextResult(confidence=0.0)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Truncate very long texts to avoid token waste (receipts shouldn't need more than this)
    truncated = raw_text[:3000]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=_SYSTEM,
        messages=[{"role": "user", "content": f"Receipt text:\n{truncated}"}],
    )

    raw = response.content[0].text.strip()
    return _parse(raw)


def _parse(raw: str) -> LLMTextResult:
    result = LLMTextResult(raw_response=raw)
    try:
        data = json.loads(raw)
        result.merchant = data.get("merchant") or None
        result.date = data.get("date") or None
        result.confidence = float(data.get("confidence") or 0.0)
        total = data.get("total")
        if total is not None:
            try:
                result.total = float(total)
            except (ValueError, TypeError):
                pass
    except (json.JSONDecodeError, TypeError):
        result.confidence = 0.0
    return result
