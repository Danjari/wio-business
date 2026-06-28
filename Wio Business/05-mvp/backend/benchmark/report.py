"""
Human-readable and JSON report output for benchmark runs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def print_extraction_report(metrics: dict, method_name: str = "Textract") -> None:
    print(f"\n{'='*60}")
    print(f"  EXTRACTION ACCURACY — {method_name}")
    print(f"{'='*60}")
    print(f"  Receipts evaluated:        {metrics['n']}")
    print(f"  Merchant exact match:      {metrics['company_exact_pct']}%")
    print(f"  Merchant partial/exact:    {metrics['company_partial_or_exact_pct']}%")
    print(f"  Date exact match:          {metrics['date_exact_pct']}%")
    print(f"  Total extracted:           {metrics['total_extracted_pct']}%")
    print(f"  Total exact (±0.01):       {metrics['total_exact_pct']}%")
    print(f"  Total within 1%:           {metrics['total_within_1pct_pct']}%")
    print(f"{'='*60}\n")


def print_categorization_report(metrics: dict, llm_cost_usd: float = 0.0) -> None:
    print(f"\n{'='*60}")
    print(f"  CATEGORIZATION AGREEMENT — LLM vs Rule-based")
    print(f"{'='*60}")
    print(f"  Receipts evaluated:        {metrics['n']}")
    print(f"  Agreement:                 {metrics['agreement']} / {metrics['n']} ({metrics['agreement_pct']}%)")
    print(f"  Disagreements:             {metrics['disagreements']} ({metrics['disagreement_pct']}%)")
    print()
    print(f"  LLM distribution:")
    for cat, count in metrics["llm_distribution"].items():
        pct = round(count / metrics["n"] * 100, 1)
        print(f"    {cat:<20} {count:>4}  ({pct}%)")
    print()
    print(f"  Rule-based distribution:")
    for cat, count in metrics["rules_distribution"].items():
        pct = round(count / metrics["n"] * 100, 1)
        print(f"    {cat:<20} {count:>4}  ({pct}%)")
    print()
    if llm_cost_usd > 0:
        print(f"  Estimated LLM cost:        ${llm_cost_usd:.4f} ({metrics['n']} receipts)")
        if metrics["disagreements"] > 0:
            unknown_rate = metrics["disagreements"] / metrics["n"]
            hybrid_cost = llm_cost_usd * unknown_rate
            print(f"  Hybrid cost (LLM only for disagreements): ${hybrid_cost:.4f}")
    print()
    print(f"  Sample disagreements (up to 50):")
    print(f"  {'Merchant':<35} {'LLM':<22} {'Rule-based'}")
    print(f"  {'-'*35} {'-'*22} {'-'*20}")
    for d in metrics["disagreement_sample"]:
        print(f"  {d['merchant'][:34]:<35} {d['llm']:<22} {d['rules']}")
    print(f"{'='*60}\n")

    verdict = (
        "Rule-based is sufficient (agreement ≥ 90%) — use it in production, save LLM cost."
        if metrics["agreement_pct"] >= 90
        else (
            "Some divergence (agreement 85–90%) — consider a hybrid: rule-based first, LLM for unknowns."
            if metrics["agreement_pct"] >= 85
            else "Significant divergence (< 85%) — LLM categorization is likely required for accuracy."
        )
    )
    print(f"  VERDICT: {verdict}\n")


def save_json(data: dict, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Results saved to {path}")
