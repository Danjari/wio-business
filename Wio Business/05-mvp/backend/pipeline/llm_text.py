"""
Gemini Flash text-only fallback for Textract extractions with missing or low-confidence fields.

Receives the raw text output from Textract and asks Gemini Flash to extract the
merchant, total, and date from it. No image is sent — only the text.

Model: gemini-2.0-flash — override with GEMINI_TEXT_MODEL in .env.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

from google import genai
from google.genai import types

_MODEL_ID = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.5-flash")

_SYSTEM = """You are an expense receipt data extractor.
Given raw OCR text from a receipt, extract the merchant name, total amount paid, currency, and date.

Return ONLY valid JSON:
{
  "merchant": "<business name or null>",
  "total": <number or null>,
  "currency": "<3-letter ISO currency code, e.g. AED, USD, MYR, EUR — or null>",
  "date": "<date string as it appears on the receipt, or null>",
  "confidence": <0.0-1.0>
}

Rules:
- merchant: the business/vendor name, not a customer name
- total: the final total amount (numeric, no currency symbols)
- currency: infer from symbols (RM/MYR, AED/Dhs, $/USD, €/EUR, £/GBP) or country context — null if unclear
- date: the transaction/receipt date (not expiry dates)
- confidence: set below 0.99 if any field is ambiguous, missing, or the text is garbled
- Use null for any field you cannot confidently determine"""


@dataclass
class LLMTextResult:
    merchant: Optional[str] = None
    total: Optional[float] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    confidence: float = 0.0
    raw_response: str = ""


def extract_from_text(raw_text: str) -> LLMTextResult:
    """
    Extract receipt fields from raw OCR text using Gemini Flash.
    Raises RuntimeError on API error.
    """
    if not raw_text.strip():
        return LLMTextResult(confidence=0.0)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY must be set")
    client = genai.Client(api_key=api_key)
    # Keep the tail of the text — receipt totals appear at the bottom, not the top.
    truncated = raw_text[-3000:] if len(raw_text) > 3000 else raw_text

    try:
        response = client.models.generate_content(
            model=_MODEL_ID,
            contents=f"Receipt text:\n{truncated}",
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                response_mime_type="application/json",
                max_output_tokens=256,
                temperature=0.0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini text API error: {exc}") from exc

    return _parse(response.text.strip())


def _parse(raw: str) -> LLMTextResult:
    result = LLMTextResult(raw_response=raw)
    try:
        data = json.loads(raw)
        result.merchant = data.get("merchant") or None
        result.currency = data.get("currency") or None
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
