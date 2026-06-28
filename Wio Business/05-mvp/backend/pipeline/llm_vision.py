"""
Gemini Flash vision fallback — last resort when Textract + text LLM both fail.

Gemini Flash natively supports image input — no base64 encoding required, just open
the file with PIL and pass it to generate_content().

Model: gemini-3.0-flash — override with GEMINI_VISION_MODEL in .env.

IMPORTANT — REGULATORY NOTE:
Sending an image to this endpoint means the receipt image is processed by Google's
infrastructure. For production deployments under CBUAE oversight, this requires:
  - A data processing agreement (DPA) with Google Cloud, OR
  - Replacement with a UAE/Gulf-region-compliant vision endpoint
    (e.g. Google Cloud Vertex AI with data residency in UAE)
This flag is logged in the audit trail every time this function is called.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import google.generativeai as genai
from PIL import Image

_MODEL_ID = os.getenv("GEMINI_VISION_MODEL", "gemini-3.0-flash")

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
    regulatory_flag: bool = True  # always True — image processed by external API


def extract_from_image(image_path: str) -> LLMVisionResult:
    """
    Extract receipt fields from an image using Gemini Flash vision.
    Raises RuntimeError on API error.
    """
    path = Path(image_path)
    if not path.exists():
        raise RuntimeError(f"Image not found: {image_path}")

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        model_name=_MODEL_ID,
        system_instruction=_SYSTEM,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            max_output_tokens=256,
            temperature=0.0,
        ),
    )

    image = Image.open(path)
    response = model.generate_content(["Extract the receipt data.", image])
    raw = response.text.strip()
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
