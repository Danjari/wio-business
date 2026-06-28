"""
LLM-based expense categorizer using Claude Haiku.

Used in two contexts:
1. Production pipeline: both this and categorize_rules.py run on every receipt;
   results stored separately for comparison. Production currently uses the rules result.
2. Benchmark: run_categorization.py calls this on all 967 merchant names from the
   fullDataset and compares agreement with the rule-based method.

Model: claude-haiku-4-5-20251001 — cheapest capable Claude model, sufficient for
single-field classification tasks.
"""

from __future__ import annotations

import json
import os
from typing import Tuple

import anthropic

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

_SYSTEM = (
    "You are an expense categorization engine for a UAE SME. "
    "Given a merchant name, return the most appropriate expense category. "
    f"Available categories: {', '.join(CATEGORIES)}.\n\n"
    'Return ONLY valid JSON: {"category": "<category>", "confidence": <0.0-1.0>}\n'
    "Set confidence below 0.9 if the merchant name is ambiguous or unknown."
)

# Few-shot examples covering UAE + Malaysian merchant types present in the dataset
_FEW_SHOT: list[dict] = [
    {"role": "user", "content": "Merchant: EMIRATES AIRLINES"},
    {"role": "assistant", "content": '{"category": "Travel", "confidence": 0.99}'},
    {"role": "user", "content": "Merchant: ROTANA HOTEL ABU DHABI"},
    {"role": "assistant", "content": '{"category": "Travel", "confidence": 0.99}'},
    {"role": "user", "content": "Merchant: PETRONAS"},
    {"role": "assistant", "content": '{"category": "Fuel", "confidence": 0.99}'},
    {"role": "user", "content": "Merchant: RESTORAN WAN SHENG"},
    {"role": "assistant", "content": '{"category": "Client Meals", "confidence": 0.97}'},
    {"role": "user", "content": "Merchant: 99 SPEED MART S/B"},
    {"role": "assistant", "content": '{"category": "Office Supplies", "confidence": 0.85}'},
    {"role": "user", "content": "Merchant: GOOGLE ADS"},
    {"role": "assistant", "content": '{"category": "Advertising", "confidence": 0.99}'},
    {"role": "user", "content": "Merchant: HUBSPOT"},
    {"role": "assistant", "content": '{"category": "SaaS Tools", "confidence": 0.99}'},
    {"role": "user", "content": "Merchant: TNB"},
    {"role": "assistant", "content": '{"category": "Utilities", "confidence": 0.97}'},
    {"role": "user", "content": "Merchant: GSC CINEMA"},
    {"role": "assistant", "content": '{"category": "Entertainment", "confidence": 0.98}'},
    {"role": "user", "content": "Merchant: GITEX GLOBAL"},
    {"role": "assistant", "content": '{"category": "Events", "confidence": 0.97}'},
]


def categorize(merchant: str) -> Tuple[str, float]:
    """
    Classify a merchant name using Claude Haiku.

    Returns:
        (category, confidence)
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    messages = _FEW_SHOT + [
        {"role": "user", "content": f"Merchant: {merchant}"}
    ]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=64,
        system=_SYSTEM,
        messages=messages,
    )

    raw = response.content[0].text.strip()
    try:
        result = json.loads(raw)
        category = str(result.get("category", _DEFAULT))
        confidence = float(result.get("confidence", 0.8))
        if category not in CATEGORIES:
            category = _DEFAULT
        return category, confidence
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        return _DEFAULT, 0.5


_DEFAULT = "Office Supplies"
