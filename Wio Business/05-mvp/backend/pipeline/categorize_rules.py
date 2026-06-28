"""
Rule-based expense categorizer — no LLM required.

Tier 1: keyword dictionary match (merchant_categories.json).
Tier 2: TF-IDF + Logistic Regression trained on manually labeled receipts.

Returns (category, method, confidence):
  - method: 'keyword' | 'tfidf' | 'unknown'
  - confidence: 1.0 for keyword matches, model probability for tfidf, 0.0 for unknown
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Tuple

_HERE = Path(__file__).parent
_KEYWORD_FILE = _HERE / "merchant_categories.json"
_MODEL_PATH = _HERE / "tfidf_model.pkl"

# Normalise internal key names → display names matching data.ts ALL_CATEGORIES
_KEY_TO_DISPLAY = {
    "TRAVEL_TRANSPORT":      "Travel & Transport",
    "MEALS_ENTERTAINMENT":   "Meals & Entertainment",
    "TECHNOLOGY_SOFTWARE":   "Technology & Software",
    "MARKETING_ADVERTISING": "Marketing & Advertising",
    "PROFESSIONAL_SERVICES": "Professional Services",
    "OFFICE_STATIONERY":     "Office & Stationery",
    "UTILITIES_TELECOM":     "Utilities & Telecom",
    "FUEL_VEHICLE":          "Fuel & Vehicle",
    "HEALTHCARE_MEDICAL":    "Healthcare & Medical",
    "EVENTS_TRAINING":       "Events & Training",
    "RENT_FACILITIES":       "Rent & Facilities",
}

_DEFAULT_CATEGORY = "Other"


def _load_keyword_map() -> dict[str, str]:
    """Build a flat {KEYWORD_UPPER: display_category} lookup."""
    with open(_KEYWORD_FILE) as f:
        raw: dict = json.load(f)

    flat: dict[str, str] = {}
    for key, keywords in raw.items():
        if key.startswith("_"):
            continue
        display = _KEY_TO_DISPLAY.get(key, key.title())
        for kw in keywords:
            # Do NOT strip() — trailing spaces are word-boundary guards (e.g. "DU " won't
            # match "DUTY", "INN " won't match "THINNER"). Only strip leading whitespace.
            flat[kw.upper().lstrip()] = display
    return flat


_KEYWORD_MAP: dict[str, str] = _load_keyword_map()


def categorize(
    merchant: str,
    items: list[str] | None = None,
    extra_text: str = "",
) -> Tuple[str, str, float]:
    """
    Classify a merchant name into an expense category.
    Pass `items` (line item descriptions) to improve accuracy for ambiguous merchants.

    Returns:
        (category, method, confidence)
    """
    items_text = " ".join(items) if items else ""
    text = (merchant + " " + items_text + " " + extra_text).upper().strip()

    # Tier 1 — keyword match against merchant name only (high precision)
    merchant_upper = merchant.upper()
    for keyword, category in _KEYWORD_MAP.items():
        if keyword in merchant_upper:
            return category, "keyword", 1.0

    # Tier 1b — keyword match against items if merchant didn't match (lower precision)
    if items_text:
        for keyword, category in _KEYWORD_MAP.items():
            if keyword in text:
                return category, "keyword_items", 0.85

    # Tier 2 — TF-IDF classifier
    if _MODEL_PATH.exists():
        try:
            with open(_MODEL_PATH, "rb") as f:
                model = pickle.load(f)
            proba = model.predict_proba([text])[0]
            best_idx = int(proba.argmax())
            confidence = float(proba[best_idx])
            if confidence >= 0.50:
                return str(model.classes_[best_idx]), "tfidf", confidence
        except Exception:
            pass

    return _DEFAULT_CATEGORY, "unknown", 0.0


def train_tfidf(labeled_data: list[dict]) -> None:
    """
    Train and save a TF-IDF + LogReg classifier.

    labeled_data: list of {'merchant': str, 'category': str}
    Category values must be display names from ALL_CATEGORIES (e.g. 'Client Meals').
    Minimum recommended: 100 examples, ≥ 5 per category.
    """
    from sklearn.linear_model import LogisticRegression
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import Pipeline

    if len(labeled_data) < 10:
        raise ValueError("Need at least 10 labeled examples to train.")

    X = [d["merchant"].upper() for d in labeled_data]
    y = [d["category"] for d in labeled_data]

    pipe = Pipeline(
        [
            # char n-grams generalise well to merchant name substrings
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=10_000)),
            ("clf", LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced")),
        ]
    )
    pipe.fit(X, y)

    with open(_MODEL_PATH, "wb") as f:
        pickle.dump(pipe, f)

    print(f"Trained on {len(X)} samples across {len(set(y))} categories.")
    print(f"Model saved to {_MODEL_PATH}")
