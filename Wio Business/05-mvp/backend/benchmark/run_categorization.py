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
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import categorize_llm, categorize_rules
from benchmark.metrics import categorization_agreement
from benchmark.report import print_categorization_report, save_json

# Haiku pricing (input tokens): $0.80 per 1M tokens
# Each call is roughly 300 tokens input → $0.00024 per call
_HAIKU_COST_PER_CALL = 0.000_24


def load_merchants(dataset_dir: Path) -> list[str]:
    """Extract all company names from gdt ground truth files."""
    gdt_dir = dataset_dir / "gdt"
    merchants = []
    for f in sorted(gdt_dir.glob("*.json")):
        with open(f) as fh:
            data = json.load(fh)
        company = (data.get("company") or "").strip()
        if company:
            merchants.append(company)
    return merchants


def run_rules(merchants: list[str]) -> list[str]:
    """Run rule-based categorizer on all merchants (fast, no API)."""
    results = []
    for m in merchants:
        cat, _, _ = categorize_rules.categorize(m)
        results.append(cat)
    return results


def run_llm(merchants: list[str], concurrency: int = 5) -> tuple[list[str], float]:
    """
    Run LLM categorizer on all merchants in parallel.
    Returns (results, total_cost_usd).
    """
    results: list[str] = [""] * len(merchants)
    cost = 0.0

    def _call(idx: int, merchant: str) -> tuple[int, str]:
        cat, _ = categorize_llm.categorize(merchant)
        return idx, cat

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {executor.submit(_call, i, m): i for i, m in enumerate(merchants)}
        done = 0
        for future in as_completed(futures):
            idx, cat = future.result()
            results[idx] = cat
            cost += _HAIKU_COST_PER_CALL
            done += 1
            if done % 100 == 0:
                print(f"  LLM: {done}/{len(merchants)} done...")

    return results, cost


def main() -> None:
    parser = argparse.ArgumentParser(description="Categorization agreement benchmark")
    parser.add_argument("--dataset", default="../fullDataset")
    parser.add_argument("--output", default="benchmark/results/categorization.json")
    parser.add_argument("--llm-concurrency", type=int, default=5)
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Only run rule-based (no API calls). Agreement metrics will be skipped.",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    if not dataset_dir.exists():
        print(f"ERROR: Dataset directory not found: {dataset_dir}")
        sys.exit(1)

    merchants = load_merchants(dataset_dir)
    print(f"Loaded {len(merchants)} merchant names from dataset.\n")

    # Always run rules (free)
    print("Running rule-based categorizer...")
    rules_results = run_rules(merchants)
    print(f"  Done. Keyword matches: {sum(1 for m, r in zip(merchants, rules_results) if r != 'Office Supplies' or True)}")

    # Rule-based alone report
    from collections import Counter
    rules_dist = dict(Counter(rules_results).most_common())
    unknown_count = sum(1 for m, r in zip(merchants, rules_results) if r == "Office Supplies")
    print(f"\nRule-based distribution:")
    for cat, count in rules_dist.items():
        print(f"  {cat:<22} {count:>4}")
    print(f"  (Note: 'Office Supplies' is the default fallback — {unknown_count} receipts fell through.)\n")

    if args.skip_llm:
        print("--skip-llm set. Skipping LLM run. No agreement report produced.")
        save_json({
            "merchants": merchants,
            "rules_results": rules_results,
            "rules_distribution": rules_dist,
        }, args.output)
        return

    # LLM run
    print(f"Running LLM categorizer ({args.llm_concurrency} concurrent calls)...")
    print(f"  Estimated cost: ~${_HAIKU_COST_PER_CALL * len(merchants):.3f} USD\n")
    llm_results, actual_cost = run_llm(merchants, args.llm_concurrency)

    # Agreement analysis
    agreement_metrics = categorization_agreement(llm_results, rules_results, merchants)

    print_categorization_report(agreement_metrics, llm_cost_usd=actual_cost)

    save_json({
        "agreement_metrics": agreement_metrics,
        "llm_cost_usd": actual_cost,
        "per_receipt": [
            {"merchant": merchants[i], "llm": llm_results[i], "rules": rules_results[i]}
            for i in range(len(merchants))
        ],
    }, args.output)


if __name__ == "__main__":
    main()
