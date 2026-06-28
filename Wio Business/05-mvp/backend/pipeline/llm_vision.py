"""
Claude Sonnet vision fallback — last resort when Textract + Haiku text both fail.

IMPORTANT — REGULATORY NOTE:
Sending an image to this endpoint means the receipt image leaves the UAE/Gulf region
and is processed by Anthropic's infrastructure in the US. For production deployments
under CBUAE oversight, this requires:
  - A data processing agreement (DPA) with Anthropic, OR
  - Replacement with an UAE/Gulf-region-compliant vision endpoint
    (e.g. Azure OpenAI with UAE data residency commitments)
This flag should be logged in the audit trail every time this function is called.
"""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import anthropic

_SYSTEM = """You are an expense receipt data extractor.
Extract the merchant name, total amount paid, and date from this receipt image.

Return ONLY valid JSON:
{
  "merchant": "<business name or null>",
  "total": <number or null>,
  "date": "<date string as it appears, or null>",
  "confidence": <0.0-1.0>
}

Set confidence below 0.99 if the image is blurry, partially cut off, or any field is unclear."""


@dataclass
class LLMVisionResult:
    merchant: Optional[str] = None
    total: Optional[float] = None
    date: Optional[str] = None
    confidence: float = 0.0
    raw_response: str = ""
    regulatory_flag: bool = True  # always True — image left UAE region


def extract_from_image(image_path: str) -> LLMVisionResult:
    """
    Extract receipt fields from an image using Claude Sonnet vision.
    Raises RuntimeError on API error.
    """
    path = Path(image_path)
    if not path.exists():
        raise RuntimeError(f"Image not found: {image_path}")

    with open(path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # Detect media type from extension
    ext = path.suffix.lower()
    media_type_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
    media_type = media_type_map.get(ext, "image/jpeg")

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": "Extract the receipt data."},
                ],
            }
        ],
    )

    raw = response.content[0].text.strip()
    return _parse(raw)


def _parse(raw: str) -> LLMVisionResult:
    result = LLMVisionResult(raw_response=raw)
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
