"""
LLM-based expense categorizer using Gemini Flash.

Two modes:
- categorize()       — single merchant, used in the live pipeline per receipt
- categorize_batch() — list of merchants in one API call, used by the benchmark

gemini-3.5-flash is a thinking model; thinking is explicitly disabled here
(thinking_budget=0) because this is a simple classification task where chain-of-thought
reasoning wastes tokens and breaks JSON mode output.
"""

from __future__ import annotations

import json
import os
import time
from typing import Tuple

from google import genai
from google.genai import types

CATEGORIES = [
    "Travel & Transport",
    "Meals & Entertainment",
    "Technology & Software",
    "Marketing & Advertising",
    "Professional Services",
    "Office & Stationery",
    "Utilities & Telecom",
    "Fuel & Vehicle",
    "Healthcare & Medical",
    "Events & Training",
    "Rent & Facilities",
    "Other",
]

_MODEL_ID = os.getenv("GEMINI_CATEGORIZE_MODEL", "gemini-3.5-flash")
_DEFAULT  = "Other"

_CATEGORIES_STR = ", ".join(f'"{c}"' for c in CATEGORIES)

_SYSTEM_SINGLE = f"""You are an expense categorization engine for a UAE SME.
Given a merchant name and optional line items, return the most appropriate expense category.

Available categories: {_CATEGORIES_STR}

Rules:
- Use the merchant name as the primary signal
- Use line items to resolve ambiguity (e.g. a generic trading company selling medicine → Healthcare & Medical)
- Use "Other" only when truly unclassifiable
- Return ONLY valid JSON: {{"category": "<category>", "confidence": <0.0-1.0>}}
- Set confidence < 0.8 for ambiguous merchants

Examples:
- EMIRATES AIRLINES → {{"category": "Travel & Transport", "confidence": 0.99}}
- ROTANA HOTEL ABU DHABI → {{"category": "Travel & Transport", "confidence": 0.99}}
- CAREEM → {{"category": "Travel & Transport", "confidence": 0.99}}
- PETRONAS → {{"category": "Fuel & Vehicle", "confidence": 0.99}}
- ADNOC → {{"category": "Fuel & Vehicle", "confidence": 0.99}}
- RESTORAN WAN SHENG → {{"category": "Meals & Entertainment", "confidence": 0.97}}
- OLD TOWN KOPITAM → {{"category": "Meals & Entertainment", "confidence": 0.97}}
- GERBANG ALAF RESTAURANTS SDN BHD → {{"category": "Meals & Entertainment", "confidence": 0.97}}
- STARBUCKS → {{"category": "Meals & Entertainment", "confidence": 0.99}}
- GSC CINEMA → {{"category": "Meals & Entertainment", "confidence": 0.97}}
- GUARDIAN HEALTH AND BEAUTY SDN BHD → {{"category": "Healthcare & Medical", "confidence": 0.97}}
- AA PHARMACY → {{"category": "Healthcare & Medical", "confidence": 0.99}}
- FARMASI → {{"category": "Healthcare & Medical", "confidence": 0.95}}
- GOOGLE ADS → {{"category": "Marketing & Advertising", "confidence": 0.99}}
- HUBSPOT → {{"category": "Technology & Software", "confidence": 0.99}}
- AWS → {{"category": "Technology & Software", "confidence": 0.99}}
- DEWA → {{"category": "Utilities & Telecom", "confidence": 0.99}}
- TNB → {{"category": "Utilities & Telecom", "confidence": 0.99}}
- GITEX GLOBAL → {{"category": "Events & Training", "confidence": 0.97}}
- UDEMY → {{"category": "Events & Training", "confidence": 0.98}}
- WEWORK DUBAI → {{"category": "Rent & Facilities", "confidence": 0.99}}
- DELOITTE UAE → {{"category": "Professional Services", "confidence": 0.99}}
- 99 SPEED MART S/B → {{"category": "Office & Stationery", "confidence": 0.80}}
- CARREFOUR → {{"category": "Office & Stationery", "confidence": 0.82}}"""

_SYSTEM_BATCH = f"""You are an expense categorization engine for a UAE SME.
You will receive a numbered list of merchants (and optional line items).
Return a JSON array of category strings, one per merchant, in the same order.

Available categories: {_CATEGORIES_STR}

Rules:
- Use merchant name as primary signal; use line items to resolve ambiguity
- Use "Other" only when truly unclassifiable
- Return ONLY a JSON array, e.g. ["Meals & Entertainment", "Fuel & Vehicle", "Other"]
- The array length must exactly match the number of input merchants

Category hints:
- RESTORAN, RESTAURANT, KOPITIAM, CAFE, KEDAI MAKAN, CUISINE → Meals & Entertainment
- PHARMACY, FARMASI, KLINIK, CLINIC, MEDICAL, HOSPITAL → Healthcare & Medical
- PETROL, PETROLEUM, FUEL, STATION, BHPETROL, PETRONAS, PETRON → Fuel & Vehicle
- HOTEL, RESORT, AIRLINES, AIRWAYS, TAXI, TRANSPORT, PARKING → Travel & Transport
- HARDWARE, STATIONERY, KEDAI, SUPERMARKET, HYPERMARKET, MART → Office & Stationery
- CONSULTING, LAW, LEGAL, AUDIT, ACCOUNTING, ADVISORY → Professional Services
- TELECOM, ELECTRIC, UTILITY, INTERNET, BROADBAND → Utilities & Telecom
- ADS, MARKETING, ADVERTISING, AGENCY → Marketing & Advertising
- SOFTWARE, CLOUD, SAAS, TECH, DIGITAL → Technology & Software
- CONFERENCE, TRAINING, EXPO, ACADEMY, CERTIFICATION → Events & Training
- OFFICE RENT, WEWORK, CO-WORKING, CLEANING SERVICE → Rent & Facilities"""


def _get_config(max_tokens: int = 128) -> types.GenerateContentConfig:
    """Shared config: thinking disabled, JSON mode, deterministic."""
    return types.GenerateContentConfig(
        system_instruction=_SYSTEM_SINGLE,
        response_mime_type="application/json",
        max_output_tokens=max_tokens,
        temperature=0.0,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )


def categorize(
    merchant: str,
    items: list[str] | None = None,
    max_retries: int = 3,
) -> Tuple[str, float]:
    """
    Classify a single merchant. Used in the live pipeline per receipt.
    Pass `items` (Textract line item descriptions) for richer context.
    Returns (category, confidence).
    """
    if not merchant or not merchant.strip():
        return _DEFAULT, 0.5

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return _DEFAULT, 0.5
    client = genai.Client(api_key=api_key)

    prompt = f"Merchant: {merchant[:200]}"
    if items:
        prompt += f"\nLine items: {', '.join(i[:80] for i in items[:12])}"

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=_MODEL_ID,
                contents=prompt,
                config=_get_config(max_tokens=128),
            )
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return _DEFAULT, 0.5

        if not response.text:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return _DEFAULT, 0.5

        try:
            result   = json.loads(response.text.strip())
            category = str(result.get("category", _DEFAULT))
            conf     = float(result.get("confidence", 0.8))
            if category not in CATEGORIES:
                category = _DEFAULT
            return category, conf
        except (json.JSONDecodeError, KeyError, ValueError, TypeError):
            return _DEFAULT, 0.5

    return _DEFAULT, 0.5


def categorize_batch(
    entries: list[dict],
    max_retries: int = 3,
) -> list[str]:
    """
    Classify multiple merchants in a single API call.
    entries: list of {"merchant": str, "items": list[str]}
    Returns list of category strings in the same order.
    Used by the benchmark — much cheaper and faster than one call per merchant.
    """
    n = len(entries)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return [_DEFAULT] * n
    client = genai.Client(api_key=api_key)

    lines = []
    for i, e in enumerate(entries, 1):
        line = f"{i}. {e['merchant']}"
        if e.get("items"):
            line += f" [items: {', '.join(e['items'][:6])}]"
        lines.append(line)
    prompt = "\n".join(lines)

    config = types.GenerateContentConfig(
        system_instruction=_SYSTEM_BATCH,
        response_mime_type="application/json",
        max_output_tokens=n * 12 + 64,  # ~10 tokens per category name + overhead
        temperature=0.0,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=_MODEL_ID,
                contents=prompt,
                config=config,
            )
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return [_DEFAULT] * n

        if not response.text:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return [_DEFAULT] * n

        try:
            result = json.loads(response.text.strip())
            if isinstance(result, list) and len(result) == n:
                return [
                    c if c in CATEGORIES else _DEFAULT
                    for c in result
                ]
            # Model returned wrong length — fall through to retry
        except (json.JSONDecodeError, TypeError):
            pass

        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)

    return [_DEFAULT] * n
