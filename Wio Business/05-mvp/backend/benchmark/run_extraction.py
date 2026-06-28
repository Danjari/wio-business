"""
Extraction benchmark: compare AWS Textract output vs fullDataset/gdt ground truth.

Usage:
    python -m benchmark.run_extraction \\
        --dataset ../fullDataset \\
        --output benchmark/results/extraction.json \\
        [--limit 50]        # process only first N receipts (for quick testing)
        [--cache]           # save Textract responses to disk; reuse on re-run

AWS credentials must be configured (.env or environment).
Results are cached in benchmark/results/textract_cache/ to avoid re-billing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# Add parent to path so pipeline imports work when run as a module
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.extract import extract_receipt, ExtractResult
from benchmark.metrics import extraction_accuracy
from benchmark.report import print_extraction_report, save_json


def load_dataset(dataset_dir: Path) -> list[dict]:
    """Load all gdt ground truth files. Returns list of {id, image_path, gdt}."""
    gdt_dir = dataset_dir / "gdt"
    images_dir = dataset_dir / "images"
    entries = []
    for gdt_file in sorted(gdt_dir.glob("*.json")):
        receipt_id = gdt_file.stem
        image_path = images_dir / f"{receipt_id}.jpg"
        if not image_path.exists():
            continue
        with open(gdt_file) as f:
            gdt = json.load(f)
        entries.append({"id": receipt_id, "image_path": str(image_path), "gdt": gdt})
    return entries


def load_or_call_textract(
    entry: dict, cache_dir: Path, use_cache: bool
) -> dict:
    """Return cached result or call Textract and cache the result."""
    cache_file = cache_dir / f"{entry['id']}.json"

    if use_cache and cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)

    result: ExtractResult = extract_receipt(entry["image_path"])
    extracted = {
        "merchant": result.merchant,
        "total": result.total,
        "total_raw": result.total_raw,
        "date": result.date,
        "textract_confidence": result.textract_confidence,
        "all_fields_present": result.all_fields_present,
        "high_confidence": result.high_confidence,
        "error": result.error,
    }

    if use_cache:
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(extracted, f)

    return extracted


def main() -> None:
    parser = argparse.ArgumentParser(description="Textract extraction benchmark")
    parser.add_argument("--dataset", default="../fullDataset", help="Path to fullDataset directory")
    parser.add_argument("--output", default="benchmark/results/extraction.json", help="Output JSON path")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N receipts")
    parser.add_argument("--cache", action="store_true", help="Cache Textract responses to disk")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    cache_dir = Path("benchmark/results/textract_cache")

    if not dataset_dir.exists():
        print(f"ERROR: Dataset directory not found: {dataset_dir}")
        sys.exit(1)

    entries = load_dataset(dataset_dir)
    if args.limit:
        entries = entries[: args.limit]

    print(f"Processing {len(entries)} receipts with Textract...")
    print("(This makes API calls — costs apply. Use --cache to avoid re-billing.)\n")

    predictions: list[dict] = []
    ground_truth: list[dict] = []
    errors = 0
    high_confidence_count = 0

    for i, entry in enumerate(entries, 1):
        try:
            extracted = load_or_call_textract(entry, cache_dir, args.cache)
            predictions.append(extracted)
            ground_truth.append(entry["gdt"])
            if extracted.get("high_confidence"):
                high_confidence_count += 1
        except RuntimeError as exc:
            print(f"  [{i}/{len(entries)}] ERROR {entry['id']}: {exc}")
            predictions.append({})
            ground_truth.append(entry["gdt"])
            errors += 1

        if i % 50 == 0:
            print(f"  [{i}/{len(entries)}] processed...")
            time.sleep(0.5)  # gentle rate limiting

    metrics = extraction_accuracy(predictions, ground_truth)
    metrics["errors"] = errors
    metrics["high_confidence_count"] = high_confidence_count
    metrics["high_confidence_pct"] = round(high_confidence_count / len(entries) * 100, 1)

    print_extraction_report(metrics)
    save_json({"metrics": metrics, "per_receipt": [
        {"id": entries[i]["id"], "prediction": predictions[i], "ground_truth": ground_truth[i]}
        for i in range(len(entries))
    ]}, args.output)


if __name__ == "__main__":
    main()
