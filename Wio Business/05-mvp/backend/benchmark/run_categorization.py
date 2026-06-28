"""
Categorization agreement benchmark: LLM vs rule-based on all gdt merchant names.

No ground truth categories exist in the dataset — the benchmark measures agreement
between the two methods and surfaces disagreements for manual review.

Usage:
    python -m benchmark.run_categorization \\
        --dataset ../fullDataset \\
        --output benchmark/results/categorization.json \\
        [--llm-concurrency 5]    # parallel LLM calls (default 5)
        [--skip-llm]             # run rules only (useful if no API key)

ANTHROPIC_API_KEY must be set for --llm to work.
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

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import categorize_rules
from pipeline.categorize_llm import categorize_batch
from benchmark.metrics import categorization_agreement
from benchmark.report import print_categorization_report, save_json, save_categorization_markdown_report

# Haiku pricing (input tokens): $0.80 per 1M tokens
# Each call is roughly 300 tokens input → $0.00024 per call
_HAIKU_COST_PER_CALL = 0.000_24


def load_entries(dataset_dir: Path, cache_dir: Path) -> list[dict]:
    """
    Load merchant names + line items (from Textract cache when available).
    Returns list of {id, merchant, items}.
    """
    from pipeline.extract import parse_textract_response

    gdt_dir = dataset_dir / "gdt"
    entries = []
    for f in sorted(gdt_dir.glob("*.json")):
        rid = f.stem
        with open(f) as fh:
            data = json.load(fh)
        merchant = (data.get("company") or "").strip()
        if not merchant:
            continue

        # Pull line items from Textract cache if available
        items: list[str] = []
        cache_file = cache_dir / f"{rid}.json"
        if cache_file.exists():
            try:
                with open(cache_file) as cf:
                    raw = json.load(cf)
                if "ExpenseDocuments" in raw:
                    result = parse_textract_response(raw)
                    items = result.line_items
            except Exception:
                pass

        entries.append({"id": rid, "merchant": merchant, "items": items})
    return entries


def run_rules(entries: list[dict]) -> list[str]:
    """Run rule-based categorizer on all entries."""
    results = []
    for e in entries:
        cat, _, _ = categorize_rules.categorize(e["merchant"], items=e["items"])
        results.append(cat)
    return results


def run_llm(entries: list[dict], batch_size: int = 20) -> tuple[list[str], float]:
    """
    Batch LLM categorizer: sends `batch_size` merchants per API call.
    Replaces 967 individual calls (~$0.23, 25+ min) with ~48 batch calls (~$0.02, <2 min).
    Returns (results, estimated_cost_usd).
    """
    n = len(entries)
    results: list[str] = []
    start = time.time()
    batches_done = 0
    total_batches = (n + batch_size - 1) // batch_size

    for i in range(0, n, batch_size):
        batch = entries[i : i + batch_size]
        batch_results = categorize_batch(batch)
        results.extend(batch_results)
        batches_done += 1

        elapsed = time.time() - start
        rate = batches_done / elapsed if elapsed > 0 else 0
        eta = int((total_batches - batches_done) / rate) if rate > 0 else 0

        # Show sample from this batch
        for j, (e, cat) in enumerate(zip(batch, batch_results)):
            items_preview = f" [{e['items'][0][:15]}...]" if e["items"] else ""
            print(f"  [{i+j+1:>4}/{n}]  {e['merchant'][:35]:<35}{items_preview:<20}  → {cat}", flush=True)

        print(f"  ── batch {batches_done}/{total_batches} done · ETA {eta}s ──", flush=True)

    cost = total_batches * _HAIKU_COST_PER_CALL * batch_size  # rough estimate
    return results, cost


def main() -> None:
    parser = argparse.ArgumentParser(description="Categorization agreement benchmark")
    parser.add_argument("--dataset", default="../fullDataset")
    parser.add_argument("--output", default="benchmark/results/categorization.json")
    parser.add_argument("--batch-size", type=int, default=20, help="Merchants per LLM call (default 20)")
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Only run rule-based (no API calls). Agreement metrics will be skipped.",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    cache_dir   = Path("benchmark/results/textract_cache")
    if not dataset_dir.exists():
        print(f"ERROR: Dataset directory not found: {dataset_dir}")
        sys.exit(1)

    entries = load_entries(dataset_dir, cache_dir)
    merchants = [e["merchant"] for e in entries]
    cached_items = sum(1 for e in entries if e["items"])
    print(f"Loaded {len(entries)} entries ({cached_items} with Textract line items).\n")

    # Always run rules (free)
    print("Running rule-based categorizer...")
    rules_results = run_rules(entries)

    # Rule-based alone report
    from collections import Counter
    rules_dist = dict(Counter(rules_results).most_common())
    unknown_count = sum(1 for r in rules_results if r == "Other")
    print(f"\nRule-based distribution:")
    for cat, count in rules_dist.items():
        print(f"  {cat:<25} {count:>4}")
    print(f"  (Note: 'Other' is the default fallback — {unknown_count} receipts fell through.)\n")

    if args.skip_llm:
        print("--skip-llm set. Skipping LLM run. No agreement report produced.")
        save_json({
            "merchants": merchants,
            "rules_results": rules_results,
            "rules_distribution": rules_dist,
        }, args.output)
        return

    # LLM run
    print(f"Running LLM categorizer (batch size {args.batch_size})...")
    print(f"  Estimated cost: ~${_HAIKU_COST_PER_CALL * len(entries):.3f} USD\n")
    llm_results, actual_cost = run_llm(entries, args.batch_size)

    # Agreement analysis
    agreement_metrics = categorization_agreement(llm_results, rules_results, merchants)

    print_categorization_report(agreement_metrics, llm_cost_usd=actual_cost)

    per_receipt = [
        {
            "id": entries[i]["id"],
            "merchant": merchants[i],
            "items": entries[i]["items"],
            "llm": llm_results[i],
            "rules": rules_results[i],
        }
        for i in range(len(entries))
    ]

    save_json({
        "agreement_metrics": agreement_metrics,
        "llm_cost_usd": actual_cost,
        "per_receipt": per_receipt,
    }, args.output)

    md_path = Path(args.output).with_suffix(".md")
    save_categorization_markdown_report(
        agreement_metrics,
        md_path,
        llm_cost_usd=actual_cost,
        per_receipt=per_receipt,
    )


if __name__ == "__main__":
    main()
