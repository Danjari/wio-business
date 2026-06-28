# Receipt Extraction Benchmark — Wio Business

**Generated:** 2026-06-28 20:44 UTC  
**Dataset:** 204 receipts (SROIE benchmark — Malaysia/Southeast Asia)  
**Method:** AWS Textract AnalyzeExpense  

---

## Executive Summary

Textract achieves **94.1% total-amount accuracy** across the full dataset. Suitable as the primary extraction engine with LLM fallback for low-confidence cases.

| Metric | Value |
|--------|-------|
| Receipts processed | 204 |
| Total field extraction rate | 99.5% |
| Total exact match (±0.01) | 94.1% |
| Total within 1% | 94.6% |
| All three fields correct | 56.9% |
| Recommended threshold | ≥ 70 |

---

## Field-Level Results

| Field | Extracted | Correct (of all) | Notes |
|-------|-----------|-----------------|-------|
| Total amount | 99.5% | 94.1% exact / 94.6% within 1% | Most critical for reconciliation |
| Merchant name | 99.5% | 64.7% exact / 64.7% fuzzy (≥80) | Used for categorization |
| Date | 98.5% | 93.6% exact | DD/MM vs MM/DD ambiguity may inflate mismatches |

---

## Confidence Threshold Analysis

Two routing strategies compared side-by-side. **New (total_conf)** routes based on the total-field confidence only — matches the updated `orchestrate.py` logic. **Legacy (agg)** used the minimum confidence across all fields.

| Threshold | Textract alone (agg) | Accuracy (agg) | Textract alone (total_conf) | Accuracy (total_conf) | → Gemini fallback |
|-----------|--------------------:|---------------:|----------------------------:|----------------------:|------------------:|
| ≥ 70 | 93.6% (191) | 95.8% | 96.6% (197) | 95.9% | 3.4% (7) ← **recommended** |
| ≥ 75 | 93.1% (190) | 95.8% | 96.6% (197) | 95.9% | 3.4% (7) |
| ≥ 80 | 91.7% (187) | 95.7% | 95.6% (195) | 95.9% | 4.4% (9) ← **current** |
| ≥ 85 | 89.7% (183) | 95.6% | 95.6% (195) | 95.9% | 4.4% (9) |
| ≥ 90 | 88.2% (180) | 95.6% | 94.1% (192) | 95.8% | 5.9% (12) |
| ≥ 95 | 84.8% (173) | 95.4% | 93.6% (191) | 95.8% | 6.4% (13) |

---

## Total Amount Deep Dive

Total amount is the single most important field — a wrong total means a wrong journal entry.

| Outcome | Count | % of all receipts |
|---------|------:|------------------:|
| Exact match (±0.01) | 192 | 94.1% |
| Within 1% | 1 | 0.5% |
| Off 1–10% (small error) | 3 | 1.5% |
| Decimal-point error (~10×) | 0 | 0.0% |
| Completely wrong (>10%) | 7 | 3.4% |
| Not extracted at all | 1 | 0.5% |

> **Decimal-point errors** (e.g. extracting 17.00 instead of 170.00) are the highest-risk failure mode for accounting reconciliation. These are the cases where the LLM fallback must catch the error.

---

## Confidence Score Distribution

| Confidence range | Count | % of all | Total accuracy |
|-----------------|------:|---------:|---------------:|
| 0–50 | 3 | 1.5% | 66.7% |
| 50–70 | 10 | 4.9% | 70.0% |
| 70–80 | 4 | 2.0% | 100.0% |
| 80–90 | 7 | 3.4% | 100.0% |
| 90–95 | 7 | 3.4% | 100.0% |
| 95–99 | 30 | 14.7% | 90.0% |
| 99–100 | 143 | 70.1% | 96.5% |

---

## Worst Failures — High Confidence, Wrong Total

*These are the most dangerous cases: Textract was confident but extracted the wrong amount.*

| Receipt | Confidence | Extracted | Ground Truth | Error |
|---------|----------:|----------:|-------------:|-------|
| 170 | 100.0 | 103.00 | 108.00 | 4.6% off |
| 129 | 100.0 | 7.65 | 7.20 | 6.3% off |
| 176 | 99.7 | 4.85 | 14.85 | 67.3% off |
| 191 | 99.7 | 5.00 | 5.80 | 13.8% off |
| 145 | 99.7 | 50.00 | 9.90 | 405.1% off |
| 162 | 98.9 | 15.00 | 14.65 | 2.4% off |
| 161 | 97.5 | 100.00 | 23.00 | 334.8% off |

---

## Dataset Notes

- **Source:** SROIE (Scanned Receipts OCR and Information Extraction) benchmark dataset
- **Geography:** Malaysia / Southeast Asia — receipts are in English and Malay, amounts in MYR (no currency symbol on most receipts)
- **UAE relevance:** This dataset does NOT include Arabic-label receipts, AED-denominated receipts, or UAE VAT receipts. Real-world UAE performance may differ. Consider supplementing with UAE receipt samples before go/no-go.
- **Ground truth fields:** company, date, total — no category ground truth exists in this dataset
- **Date ambiguity:** DD/MM/YYYY (Malaysia standard) vs MM/DD/YYYY (US standard) — some date mismatches may be format-only, not extraction failures

---

## Cost & Performance

| Item | Value |
|------|-------|
| Total receipts | 204 |
| Textract API calls | 0 |
| Cache hits (saved calls) | 204 |
| Textract cost (AnalyzeExpense @ $0.0015/page) | $0.0000 |
| Processing time | 0m 0s |
