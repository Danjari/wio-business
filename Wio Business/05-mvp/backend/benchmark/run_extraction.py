"""
Extraction benchmark: compare AWS Textract output vs fullDataset/gdt ground truth.

Usage:
    python -m benchmark.run_extraction \\
        --dataset ../fullDataset \\
        --output benchmark/results/extraction \\
        [--limit 50]     # process only first N receipts (quick smoke test)
        [--no-cache]     # force fresh Textract calls even if cached (re-bills you)

--output is a path prefix. Both extraction.json and extraction.md are written.

AWS credentials must be configured in .env.
Textract responses are cached to benchmark/results/textract_cache/ by default.
Each cached call saves $0.0015. On a 967-receipt run, caching saves ~$1.45.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.extract import extract_receipt, parse_textract_response, ExtractResult
from benchmark.metrics import extraction_accuracy
from benchmark.report import print_extraction_report, save_json, save_markdown_report


def load_dataset(dataset_dir: Path) -> list[dict]:
    """Load gdt ground truth. Returns [{id, image_path, gdt}, ...]."""
    gdt_dir    = dataset_dir / "gdt"
    images_dir = dataset_dir / "images"
    entries = []
    for gdt_file in sorted(gdt_dir.glob("*.json")):
        rid = gdt_file.stem
        img = images_dir / f"{rid}.jpg"
        if not img.exists():
            img = images_dir / f"{rid}.png"
        if not img.exists():
            continue
        with open(gdt_file) as f:
            gdt = json.load(f)
        entries.append({"id": rid, "image_path": str(img), "gdt": gdt})
    return entries


def load_or_call_textract(entry: dict, cache_dir: Path, use_cache: bool) -> tuple[dict, bool]:
    """
    Return (extracted_dict, from_cache).

    Caches the RAW Textract API response (not the parsed result) so that
    improvements to the parsing logic take effect on re-runs without new API calls.

    Backward compat: old cache files stored the parsed dict (no "ExpenseDocuments" key).
    Those are detected and ignored — a fresh API call is made and the raw response cached.
    """
    cache_file = cache_dir / f"{entry['id']}.json"

    if use_cache and cache_file.exists():
        with open(cache_file) as f:
            cached = json.load(f)
        # New format has raw Textract response; old format has parsed fields.
        if "ExpenseDocuments" in cached:
            result = parse_textract_response(cached)
            return _result_to_dict(result), True
        # Old format — fall through to make a fresh API call and re-cache.

    result: ExtractResult = extract_receipt(entry["image_path"])

    if use_cache:
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(result.raw_response, f)

    return _result_to_dict(result), False


def _result_to_dict(result: ExtractResult) -> dict:
    return {
        "merchant":             result.merchant,
        "total":                result.total,
        "total_raw":            result.total_raw,
        "date":                 result.date,
        "textract_confidence":  result.textract_confidence,
        "total_confidence":     result.total_confidence,
        "merchant_confidence":  result.merchant_confidence,
        "date_confidence":      result.date_confidence,
        "all_fields_present":   result.all_fields_present,
        "high_confidence":      result.high_confidence,
        "error":                result.error,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Textract extraction benchmark")
    parser.add_argument(
        "--dataset", default="../fullDataset",
        help="Path to fullDataset directory (default: ../fullDataset)"
    )
    parser.add_argument(
        "--output", default="benchmark/results/extraction",
        help="Output path prefix — writes <prefix>.json and <prefix>.md"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Process only first N receipts (useful for smoke tests)"
    )
    parser.add_argument(
        "--no-cache", action="store_true",
        help="Disable caching — makes fresh Textract calls every run (costs money)"
    )
    args = parser.parse_args()

    use_cache  = not args.no_cache
    dataset_dir = Path(args.dataset)
    cache_dir   = Path("benchmark/results/textract_cache")

    if not dataset_dir.exists():
        print(f"ERROR: dataset not found at {dataset_dir}")
        sys.exit(1)

    entries = load_dataset(dataset_dir)
    if args.limit:
        entries = entries[: args.limit]

    n = len(entries)
    print(f"\nExtraction benchmark — {n} receipts")
    print(f"Cache: {'ON (benchmark/results/textract_cache/)' if use_cache else 'OFF — fresh API calls'}")
    print(f"Estimated cost if all uncached: ${n * 0.0015:.2f}\n")

    predictions: list[dict] = []
    ground_truth: list[dict] = []
    ids: list[str] = []
    errors = 0
    cache_hits = 0
    api_calls = 0
    start = time.time()

    for i, entry in enumerate(entries, 1):
        from_cache = True
        try:
            extracted, from_cache = load_or_call_textract(entry, cache_dir, use_cache)
            predictions.append(extracted)
            ground_truth.append(entry["gdt"])
            ids.append(entry["id"])

            if from_cache:
                cache_hits += 1
                status = "cache"
            else:
                api_calls += 1
                status = "api  "

            # Per-receipt line: show total + confidence
            t     = extracted.get("total")
            conf  = extracted.get("textract_confidence") or 0.0
            t_str = f"{t:.2f}" if t is not None else "—"
            print(f"  [{i:>4}/{n}] {status}  {entry['id']}  "
                  f"total={t_str:<10} conf={conf:.1f}")

        except RuntimeError as exc:
            print(f"  [{i:>4}/{n}] ERROR  {entry['id']}  {exc}")
            predictions.append({"textract_confidence": 0.0})
            ground_truth.append(entry["gdt"])
            ids.append(entry["id"])
            errors += 1

        # Rate-limit live API calls to avoid throttling
        if not from_cache and i % 10 == 0:
            time.sleep(0.3)

    elapsed = time.time() - start
    print(f"\nDone. {n} receipts in {int(elapsed//60)}m {int(elapsed%60)}s "
          f"({cache_hits} cached, {api_calls} API calls, {errors} errors)\n")

    metrics = extraction_accuracy(predictions, ground_truth, ids=ids)
    metrics["errors"] = errors

    print_extraction_report(metrics)

    # Save JSON (full per-receipt data for further analysis)
    json_path = Path(args.output).with_suffix(".json")
    save_json({
        "metrics": {k: v for k, v in metrics.items() if k != "per_receipt"},
        "per_receipt": [
            {
                "id":           ids[i],
                "prediction":   predictions[i],
                "ground_truth": ground_truth[i],
            }
            for i in range(n)
        ],
    }, json_path)

    # Save Markdown decision report
    md_path = Path(args.output).with_suffix(".md")
    save_markdown_report(
        metrics,
        md_path,
        elapsed_sec=elapsed,
        cache_hits=cache_hits,
        total_api_calls=api_calls,
    )


if __name__ == "__main__":
    main()
