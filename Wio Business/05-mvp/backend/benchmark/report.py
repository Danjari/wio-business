"""
Human-readable, JSON, and Markdown report output for benchmark runs.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


# ── Extraction reports ────────────────────────────────────────────────────────

def print_extraction_report(metrics: dict) -> None:
    n = metrics["n"]
    W = 62
    print(f"\n{'='*W}")
    print(f"  EXTRACTION BENCHMARK — AWS Textract AnalyzeExpense")
    print(f"{'='*W}")
    print(f"  Receipts evaluated          {n}")
    print(f"  Errors (API failures)       {metrics.get('errors', 0)}")
    print()
    print(f"  ── Field extraction rates ──────────────────────────")
    print(f"  Merchant extracted          {metrics['merchant_extracted_pct']}%")
    print(f"  Date extracted              {metrics['date_extracted_pct']}%")
    print(f"  Total extracted             {metrics['total_extracted_pct']}%")
    print()
    print(f"  ── Accuracy (% of ALL receipts) ────────────────────")
    print(f"  Merchant exact              {metrics['merchant_exact_pct']}%")
    print(f"  Merchant fuzzy (≥80)        {metrics['merchant_fuzzy_pct']}%")
    print(f"  Date exact                  {metrics['date_exact_pct']}%")
    print(f"  Total exact (±0.01)         {metrics['total_exact_pct']}%")
    print(f"  Total within 1%             {metrics['total_within1pct_pct']}%")
    print(f"  All three correct           {metrics['all_three_correct_pct']}%")
    print()
    print(f"  ── Total amount error breakdown ────────────────────")
    print(f"  Exact (±0.01)               {metrics['total_n_exact']} / {metrics['total_n_extracted']} extracted  ({metrics['total_exact_of_extracted']}%)")
    print(f"  Near (≤1%)                  {metrics['total_n_near']}")
    print(f"  Off 1–10%                   {metrics['total_n_small_err']}")
    print(f"  Decimal-point error (~10×)  {metrics['total_n_factor10_err']}")
    print(f"  Completely wrong (>10%)     {metrics['total_n_large_err']}")
    print(f"  Not extracted               {metrics['total_n_not_extracted']}")
    print()
    print(f"  ── Confidence threshold analysis ───────────────────────────────────────────────")
    print(f"  {'':>5}  {'─── aggregate conf (legacy) ───':>32}  {'─── total_conf only (new) ─────':>32}")
    print(f"  {'Thresh':>5}  {'Textract alone':>14}  {'Accuracy':>8}  {'→ LLM':>7}  "
          f"  {'Textract alone':>14}  {'Accuracy':>8}  {'→ LLM':>7}")
    for row in metrics["threshold_analysis"]:
        marker = " ←" if row["threshold"] == 80 else ""
        print(f"  ≥ {row['threshold']:>3}  "
              f"{row['pct_high']:>6.1f}% ({row['n_high']:>4})  {row['total_accuracy_high']:>7.1f}%  "
              f"{row['pct_low']:>4.0f}% ({row['n_low']:>3})  "
              f"  {row['pct_t_high']:>6.1f}% ({row['nt_high']:>4})  {row['total_accuracy_t_high']:>7.1f}%  "
              f"{row['pct_t_low']:>4.0f}% ({row['nt_low']:>3}){marker}")
    print(f"{'='*W}\n")


def save_markdown_report(
    metrics: dict,
    output_path: str | Path,
    elapsed_sec: float = 0,
    cache_hits: int = 0,
    total_api_calls: int = 0,
) -> None:
    """Write a structured Markdown report suitable for sharing in a pitch context."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = metrics["n"]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    textract_cost = total_api_calls * 0.0015

    # Choose verdict
    total_acc = metrics["total_exact_pct"]
    if total_acc >= 80:
        verdict = (
            f"Textract achieves **{total_acc}% total-amount accuracy** across the full dataset. "
            "Suitable as the primary extraction engine with LLM fallback for low-confidence cases."
        )
    elif total_acc >= 60:
        verdict = (
            f"Textract achieves **{total_acc}% total-amount accuracy**. "
            "Acceptable as a primary engine but the LLM fallback threshold should be tuned carefully."
        )
    else:
        verdict = (
            f"Textract achieves only **{total_acc}% total-amount accuracy**. "
            "LLM Vision fallback is likely needed for a larger share of receipts than anticipated."
        )

    # Recommended threshold: highest total_accuracy_high that still handles ≥60% of receipts
    best_row = max(
        (r for r in metrics["threshold_analysis"] if r["pct_high"] >= 60),
        key=lambda r: r["total_accuracy_high"],
        default=metrics["threshold_analysis"][2],  # fallback to 80
    )

    lines: list[str] = [
        f"# Receipt Extraction Benchmark — Wio Business",
        f"",
        f"**Generated:** {now}  ",
        f"**Dataset:** {n} receipts (SROIE benchmark — Malaysia/Southeast Asia)  ",
        f"**Method:** AWS Textract AnalyzeExpense  ",
        f"",
        f"---",
        f"",
        f"## Executive Summary",
        f"",
        f"{verdict}",
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Receipts processed | {n} |",
        f"| Total field extraction rate | {metrics['total_extracted_pct']}% |",
        f"| Total exact match (±0.01) | {metrics['total_exact_pct']}% |",
        f"| Total within 1% | {metrics['total_within1pct_pct']}% |",
        f"| All three fields correct | {metrics['all_three_correct_pct']}% |",
        f"| Recommended threshold | ≥ {best_row['threshold']} |",
        f"",
        f"---",
        f"",
        f"## Field-Level Results",
        f"",
        f"| Field | Extracted | Correct (of all) | Notes |",
        f"|-------|-----------|-----------------|-------|",
        f"| Total amount | {metrics['total_extracted_pct']}% | {metrics['total_exact_pct']}% exact / {metrics['total_within1pct_pct']}% within 1% | Most critical for reconciliation |",
        f"| Merchant name | {metrics['merchant_extracted_pct']}% | {metrics['merchant_exact_pct']}% exact / {metrics['merchant_fuzzy_pct']}% fuzzy (≥80) | Used for categorization |",
        f"| Date | {metrics['date_extracted_pct']}% | {metrics['date_exact_pct']}% exact | DD/MM vs MM/DD ambiguity may inflate mismatches |",
        f"",
        f"---",
        f"",
        f"## Confidence Threshold Analysis",
        f"",
        f"Two routing strategies compared side-by-side. **New (total_conf)** routes based on the total-field confidence only — matches the updated `orchestrate.py` logic. **Legacy (agg)** used the minimum confidence across all fields.",
        f"",
        f"| Threshold | Textract alone (agg) | Accuracy (agg) | Textract alone (total_conf) | Accuracy (total_conf) | → Gemini fallback |",
        f"|-----------|--------------------:|---------------:|----------------------------:|----------------------:|------------------:|",
    ]

    for row in metrics["threshold_analysis"]:
        marker = " ← **current**" if row["threshold"] == 80 else (
            " ← **recommended**" if row["threshold"] == best_row["threshold"] and row["threshold"] != 80 else ""
        )
        lines.append(
            f"| ≥ {row['threshold']} | {row['pct_high']:.1f}% ({row['n_high']}) | "
            f"{row['total_accuracy_high']:.1f}% | "
            f"{row['pct_t_high']:.1f}% ({row['nt_high']}) | "
            f"{row['total_accuracy_t_high']:.1f}% | "
            f"{row['pct_t_low']:.1f}% ({row['nt_low']}){marker} |"
        )

    lines += [
        f"",
        f"---",
        f"",
        f"## Total Amount Deep Dive",
        f"",
        f"Total amount is the single most important field — a wrong total means a wrong journal entry.",
        f"",
        f"| Outcome | Count | % of all receipts |",
        f"|---------|------:|------------------:|",
        f"| Exact match (±0.01) | {metrics['total_n_exact']} | {metrics['total_exact_pct']}% |",
        f"| Within 1% | {metrics['total_n_near']} | {round(metrics['total_n_near']/n*100, 1)}% |",
        f"| Off 1–10% (small error) | {metrics['total_n_small_err']} | {round(metrics['total_n_small_err']/n*100, 1)}% |",
        f"| Decimal-point error (~10×) | {metrics['total_n_factor10_err']} | {round(metrics['total_n_factor10_err']/n*100, 1)}% |",
        f"| Completely wrong (>10%) | {metrics['total_n_large_err']} | {round(metrics['total_n_large_err']/n*100, 1)}% |",
        f"| Not extracted at all | {metrics['total_n_not_extracted']} | {round(metrics['total_n_not_extracted']/n*100, 1)}% |",
        f"",
        f"> **Decimal-point errors** (e.g. extracting 17.00 instead of 170.00) are the highest-risk failure mode for accounting reconciliation. These are the cases where the LLM fallback must catch the error.",
        f"",
        f"---",
        f"",
        f"## Confidence Score Distribution",
        f"",
        f"| Confidence range | Count | % of all | Total accuracy |",
        f"|-----------------|------:|---------:|---------------:|",
    ]

    for b in metrics["confidence_buckets"]:
        lines.append(
            f"| {b['label']} | {b['count']} | {b['pct_of_all']}% | {b['total_accuracy']}% |"
        )

    lines += [
        f"",
        f"---",
        f"",
        f"## Worst Failures — High Confidence, Wrong Total",
        f"",
        f"*These are the most dangerous cases: Textract was confident but extracted the wrong amount.*",
        f"",
        f"| Receipt | Confidence | Extracted | Ground Truth | Error |",
        f"|---------|----------:|----------:|-------------:|-------|",
    ]

    for r in metrics["worst_failures"]:
        pred_t = f"{r['pred_total']:.2f}" if r["pred_total"] is not None else "—"
        gt_t   = f"{r['gt_total']:.2f}"   if r["gt_total"]   is not None else "—"
        delta  = f"{r['delta_pct']:.1f}%" if r["delta_pct"]  is not None else "—"
        lines.append(
            f"| {r['id']} | {r['conf']:.1f} | {pred_t} | {gt_t} | {delta} off |"
        )

    if not metrics["worst_failures"]:
        lines.append("| — | — | — | — | No high-confidence failures |")

    lines += [
        f"",
        f"---",
        f"",
        f"## Dataset Notes",
        f"",
        f"- **Source:** SROIE (Scanned Receipts OCR and Information Extraction) benchmark dataset",
        f"- **Geography:** Malaysia / Southeast Asia — receipts are in English and Malay, amounts in MYR (no currency symbol on most receipts)",
        f"- **UAE relevance:** This dataset does NOT include Arabic-label receipts, AED-denominated receipts, or UAE VAT receipts. Real-world UAE performance may differ. Consider supplementing with UAE receipt samples before go/no-go.",
        f"- **Ground truth fields:** company, date, total — no category ground truth exists in this dataset",
        f"- **Date ambiguity:** DD/MM/YYYY (Malaysia standard) vs MM/DD/YYYY (US standard) — some date mismatches may be format-only, not extraction failures",
        f"",
        f"---",
        f"",
        f"## Cost & Performance",
        f"",
        f"| Item | Value |",
        f"|------|-------|",
        f"| Total receipts | {n} |",
        f"| Textract API calls | {total_api_calls} |",
        f"| Cache hits (saved calls) | {cache_hits} |",
        f"| Textract cost (AnalyzeExpense @ $0.0015/page) | ${textract_cost:.4f} |",
        f"| Processing time | {int(elapsed_sec//60)}m {int(elapsed_sec%60)}s |",
        f"",
    ]

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Markdown report saved to {path}")


# ── Categorization reports ────────────────────────────────────────────────────

def print_categorization_report(metrics: dict, llm_cost_usd: float = 0.0) -> None:
    W = 62
    print(f"\n{'='*W}")
    print(f"  CATEGORIZATION AGREEMENT — LLM vs Rule-based")
    print(f"{'='*W}")
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
            hybrid_cost = llm_cost_usd * metrics["disagreements"] / metrics["n"]
            print(f"  Hybrid cost (LLM for unknowns only): ${hybrid_cost:.4f}")
    print()
    print(f"  Sample disagreements (up to 50):")
    print(f"  {'Merchant':<35} {'LLM':<22} {'Rule-based'}")
    print(f"  {'-'*35} {'-'*22} {'-'*20}")
    for d in metrics["disagreement_sample"]:
        print(f"  {d['merchant'][:34]:<35} {d['llm']:<22} {d['rules']}")
    print()
    if metrics["agreement_pct"] >= 90:
        verdict = "Rule-based is sufficient (≥90% agreement) — use it in production, save LLM cost."
    elif metrics["agreement_pct"] >= 85:
        verdict = "Some divergence (85–90%) — consider hybrid: rule-based first, LLM for unknowns."
    else:
        verdict = "Significant divergence (<85%) — LLM categorization is likely required."
    print(f"  VERDICT: {verdict}\n")
    print(f"{'='*W}\n")


def save_categorization_markdown_report(
    metrics: dict,
    output_path: str | Path,
    llm_cost_usd: float = 0.0,
    per_receipt: list[dict] | None = None,
) -> None:
    """Write a structured Markdown categorization report."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n   = metrics["n"]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # Classify disagreements: "LLM fills gap" (rules=Other) vs "genuine conflict" (both had opinion)
    rules_other_llm_specific = sum(
        1 for d in (per_receipt or [])
        if d.get("rules") == "Other" and d.get("llm") != "Other"
    )
    genuine_conflict = metrics["disagreements"] - rules_other_llm_specific
    hybrid_cost = llm_cost_usd * rules_other_llm_specific / n if n else 0

    # Verdict
    if metrics["agreement_pct"] >= 90:
        verdict = (
            f"**{metrics['agreement_pct']}% agreement** between LLM and rule-based. "
            "Rule-based is sufficient for production — use LLM only as a spot-check."
        )
    elif metrics["agreement_pct"] >= 75:
        verdict = (
            f"**{metrics['agreement_pct']}% agreement**. "
            "Hybrid approach recommended: rules first, LLM for unknowns only."
        )
    else:
        rules_other_pct = round(metrics["rules_distribution"].get("Other", 0) / n * 100, 1)
        verdict = (
            f"**{metrics['agreement_pct']}% raw agreement**, but {rules_other_pct}% of rules output was 'Other' "
            f"(unclassified). Most disagreements ({rules_other_llm_specific}/{metrics['disagreements']}) "
            "are the LLM resolving gaps the rules couldn't — not genuine conflicts. "
            "**Hybrid approach is the right call**: rules handle what they know, LLM handles the rest."
        )

    lines: list[str] = [
        f"# Categorization Benchmark — Wio Business",
        f"",
        f"**Generated:** {now}  ",
        f"**Dataset:** {n} receipts (SROIE benchmark — Malaysia/Southeast Asia)  ",
        f"**Methods compared:** Rule-based keyword matching vs Gemini Flash (batch, thinking disabled)  ",
        f"",
        f"---",
        f"",
        f"## Executive Summary",
        f"",
        verdict,
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Receipts evaluated | {n} |",
        f"| Agreement | {metrics['agreement']} / {n} ({metrics['agreement_pct']}%) |",
        f"| Disagreements (total) | {metrics['disagreements']} ({metrics['disagreement_pct']}%) |",
        f"| — LLM fills rules gap (rules=Other) | {rules_other_llm_specific} |",
        f"| — Genuine conflict (both had opinion) | {genuine_conflict} |",
        f"| LLM says 'Other' | {metrics['llm_distribution'].get('Other', 0)} ({round(metrics['llm_distribution'].get('Other', 0)/n*100, 1)}%) |",
        f"| Rules says 'Other' | {metrics['rules_distribution'].get('Other', 0)} ({round(metrics['rules_distribution'].get('Other', 0)/n*100, 1)}%) |",
        f"",
        f"---",
        f"",
        f"## Category Distribution",
        f"",
        f"| Category | LLM count | LLM % | Rules count | Rules % |",
        f"|----------|----------:|------:|------------:|--------:|",
    ]

    all_cats = sorted(
        set(metrics["llm_distribution"]) | set(metrics["rules_distribution"])
    )
    for cat in all_cats:
        llm_n   = metrics["llm_distribution"].get(cat, 0)
        rules_n = metrics["rules_distribution"].get(cat, 0)
        lines.append(
            f"| {cat} | {llm_n} | {round(llm_n/n*100,1)}% | {rules_n} | {round(rules_n/n*100,1)}% |"
        )

    lines += [
        f"",
        f"---",
        f"",
        f"## Disagreement Analysis",
        f"",
        f"Of the {metrics['disagreements']} disagreements:",
        f"",
        f"- **{rules_other_llm_specific} are gap-fills**: rules returned 'Other' (no keyword match), LLM assigned a specific category. LLM is almost certainly correct in these cases.",
        f"- **{genuine_conflict} are genuine conflicts**: both methods had an opinion but differed. These need manual review to determine ground truth.",
        f"",
        f"### Sample Disagreements",
        f"",
        f"| Merchant | LLM | Rules | Type |",
        f"|----------|-----|-------|------|",
    ]

    for d in (metrics.get("disagreement_sample") or [])[:30]:
        conflict_type = "gap-fill" if d["rules"] == "Other" else "conflict"
        lines.append(f"| {d['merchant']} | {d['llm']} | {d['rules']} | {conflict_type} |")

    lines += [
        f"",
        f"---",
        f"",
        f"## Production Recommendation",
        f"",
        f"**Use a hybrid pipeline:**",
        f"",
        f"```",
        f"1. Run rule-based categorizer (free, <1ms, deterministic)",
        f"2. If result = 'Other' → call Gemini Flash with merchant + line items",
        f"3. Zoho Books sync uses whichever result is available",
        f"```",
        f"",
        f"This covers {n - metrics['rules_distribution'].get('Other', 0)}/{n} receipts with rules alone "
        f"({round((n - metrics['rules_distribution'].get('Other', 0))/n*100, 1)}% rule coverage), "
        f"and uses LLM only for the {metrics['rules_distribution'].get('Other', 0)} unknowns.",
        f"",
        f"| Approach | API calls | Estimated cost |",
        f"|----------|----------:|---------------:|",
        f"| All LLM | {n} | ${llm_cost_usd:.4f} |",
        f"| Hybrid (LLM for unknowns only) | {metrics['rules_distribution'].get('Other', 0)} | ${hybrid_cost:.4f} |",
        f"| Rules only | 0 | $0.0000 |",
        f"",
        f"---",
        f"",
        f"## Dataset Notes",
        f"",
        f"- **SROIE caveat:** Malaysian/Southeast Asian merchants. UAE merchants (ADNOC, Carrefour, Talabat, Careem) will have higher rule-based coverage since they are recognisable brand names.",
        f"- **Rule-based 'Other' rate ({round(metrics['rules_distribution'].get('Other', 0)/n*100,1)}%)** is inflated by obscure Malaysian company names (e.g. 'SYARIKAT PERNIAGAAN GIN KEE'). Expect <15% 'Other' on UAE receipt traffic.",
        f"- **No ground truth categories** exist in SROIE — agreement metrics compare two methods, not accuracy vs a labeled set.",
        f"",
    ]

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Markdown report saved to {path}")


# ── Shared ────────────────────────────────────────────────────────────────────

def save_json(data: dict, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  JSON results saved to {path}")
