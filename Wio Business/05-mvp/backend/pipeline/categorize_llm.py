"""
LLM-based expense categorizer using Gemini Flash.

Used in two contexts:
1. Production pipeline: both this and categorize_rules.py run on every receipt;
   results stored separately for comparison. Production currently uses the rules result.
2. Benchmark: run_categorization.py calls this on all 967 merchant names from the
   fullDataset and compares agreement with the rule-based method.

Model: gemini-2.0-flash — fast, cheap, sufficient for single-field classification.
Update GEMINI_CATEGORIZE_MODEL in .env to override.
"""

from __future__ import annotations

import json
import os
from typing import Tuple

from google import genai
from google.genai import types

CATEGORIES = [
    "Travel",
    "Office Supplies",
    "Advertising",
    "SaaS Tools",
    "Client Meals",
    "Entertainment",
    "Utilities",
    "Events",
    "Fuel",
]

_MODEL_ID = os.getenv("GEMINI_CATEGORIZE_MODEL", "gemini-3.5-flash")

_SYSTEM = (
    "You are an expense categorization engine for a UAE SME. "
    "Given a merchant name, return the most appropriate expense category.\n\n"
    f"Available categories: {', '.join(CATEGORIES)}.\n\n"
    'Return ONLY valid JSON: {"category": "<category>", "confidence": <0.0-1.0>}\n'
    "Set confidence below 0.9 if the merchant name is ambiguous or unknown."
)

_FEW_SHOT = """Examples:
Merchant: EMIRATES AIRLINES → {"category": "Travel", "confidence": 0.99}
Merchant: ROTANA HOTEL ABU DHABI → {"category": "Travel", "confidence": 0.99}
Merchant: PETRONAS → {"category": "Fuel", "confidence": 0.99}
Merchant: RESTORAN WAN SHENG → {"category": "Client Meals", "confidence": 0.97}
Merchant: 99 SPEED MART S/B → {"category": "Office Supplies", "confidence": 0.85}
Merchant: GOOGLE ADS → {"category": "Advertising", "confidence": 0.99}
Merchant: HUBSPOT → {"category": "SaaS Tools", "confidence": 0.99}
Merchant: TNB → {"category": "Utilities", "confidence": 0.97}
Merchant: GSC CINEMA → {"category": "Entertainment", "confidence": 0.98}
Merchant: GITEX GLOBAL → {"category": "Events", "confidence": 0.97}

"""

_DEFAULT = "Office Supplies"


def categorize(merchant: str) -> Tuple[str, float]:
    """
    Classify a merchant name using Gemini Flash.
    Returns (category, confidence).
    """
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    prompt = _FEW_SHOT + f"Merchant: {merchant}"

    try:
        response = client.models.generate_content(
            model=_MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                response_mime_type="application/json",
                max_output_tokens=64,
                temperature=0.0,
            ),
        )
    except Exception:
        return _DEFAULT, 0.5

    try:
        result = json.loads(response.text.strip())
        category = str(result.get("category", _DEFAULT))
        confidence = float(result.get("confidence", 0.8))
        if category not in CATEGORIES:
            category = _DEFAULT
        return category, confidence
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        return _DEFAULT, 0.5
