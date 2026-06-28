"""
Interactive CLI to manually label a subset of receipts for TF-IDF training.

Run this to build the training dataset for categorize_rules.train_tfidf().
Labels are saved to benchmark/results/labeled.json incrementally — you can
stop and resume at any time.

Usage:
    python -m benchmark.label_subset \\
        --dataset ../fullDataset \\
        --n 150             # number of receipts to label
        [--resume]          # continue from where you left off
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.categorize_rules import _KEY_TO_DISPLAY

CATEGORIES = list(_KEY_TO_DISPLAY.values())
LABELS_FILE = Path("benchmark/results/labeled.json")

SHORTCUT_MAP = {str(i + 1): cat for i, cat in enumerate(CATEGORIES)}


def load_merchants(dataset_dir: Path) -> list[dict]:
    """Load merchant names from gdt/."""
    gdt_dir = dataset_dir / "gdt"
    entries = []
    for f in sorted(gdt_dir.glob("*.json")):
        with open(f) as fh:
            data = json.load(fh)
        company = (data.get("company") or "").strip()
        if company:
            entries.append({"id": f.stem, "merchant": company})
    return entries


def load_existing_labels() -> dict[str, str]:
    if LABELS_FILE.exists():
        with open(LABELS_FILE) as f:
            return {item["id"]: item["category"] for item in json.load(f)}
    return {}


def save_labels(labels: dict[str, str], merchants_by_id: dict[str, str]) -> None:
    LABELS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = [
        {"id": k, "merchant": merchants_by_id[k], "category": v}
        for k, v in labels.items()
    ]
    with open(LABELS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Interactive receipt labeling tool")
    parser.add_argument("--dataset", default="../fullDataset")
    parser.add_argument("--n", type=int, default=150, help="Number of receipts to label")
    parser.add_argument("--resume", action="store_true", help="Skip already-labeled receipts")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    entries = load_merchants(dataset_dir)
    merchants_by_id = {e["id"]: e["merchant"] for e in entries}
    existing = load_existing_labels() if args.resume else {}

    # Shuffle for varied merchant coverage
    random.shuffle(entries)

    to_label = [e for e in entries if e["id"] not in existing][: args.n]
    labels = dict(existing)

    print("\n" + "=" * 60)
    print(f"  RECEIPT LABELING — {len(to_label)} receipts to label")
    print("=" * 60)
    print("\nCategories:")
    for i, cat in enumerate(CATEGORIES, 1):
        print(f"  {i}. {cat}")
    print("\n  Type the number, or 's' to skip, 'q' to save and quit.\n")

    for idx, entry in enumerate(to_label, 1):
        merchant = entry["merchant"]
        print(f"[{idx}/{len(to_label)}]  {merchant}")
        while True:
            choice = input("  Category (1-9 / s / q): ").strip().lower()
            if choice == "q":
                save_labels(labels, merchants_by_id)
                print(f"\nSaved {len(labels)} labels to {LABELS_FILE}")
                _offer_train(labels, merchants_by_id)
                return
            if choice == "s":
                break
            if choice in SHORTCUT_MAP:
                labels[entry["id"]] = SHORTCUT_MAP[choice]
                print(f"  → {SHORTCUT_MAP[choice]}\n")
                break
            print("  Invalid choice. Enter a number 1-9, 's', or 'q'.")

    save_labels(labels, merchants_by_id)
    print(f"\nDone. Saved {len(labels)} labels to {LABELS_FILE}")
    _offer_train(labels, merchants_by_id)


def _offer_train(labels: dict[str, str], merchants_by_id: dict[str, str]) -> None:
    if len(labels) < 30:
        print(f"Only {len(labels)} labels so far — need ≥ 30 to train (100+ recommended).")
        return
    choice = input(f"\nTrain TF-IDF classifier now on {len(labels)} labels? (y/n): ").strip().lower()
    if choice == "y":
        from pipeline.categorize_rules import train_tfidf
        data = [
            {"merchant": merchants_by_id[k], "category": v}
            for k, v in labels.items()
            if k in merchants_by_id
        ]
        train_tfidf(data)


if __name__ == "__main__":
    main()
