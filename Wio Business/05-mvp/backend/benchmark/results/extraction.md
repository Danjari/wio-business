# Receipt Extraction Benchmark — Wio Business

**Generated:** 2026-06-28 22:00 UTC  
**Dataset:** 967 receipts (SROIE benchmark — Malaysia/Southeast Asia)  
**Method:** AWS Textract AnalyzeExpense  

---

## Executive Summary

Textract achieves **94.8% total-amount accuracy** across the full dataset. Suitable as the primary extraction engine with LLM fallback for low-confidence cases.

| Metric | Value |
|--------|-------|
| Receipts processed | 967 |
| Total field extraction rate | 99.7% |
| Total exact match (±0.01) | 94.8% |
| Total within 1% | 96.7% |
| All three fields correct | 64.2% |
| Recommended threshold | ≥ 95 |

---

## Field-Level Results

| Field | Extracted | Correct (of all) | Notes |
|-------|-----------|-----------------|-------|
| Total amount | 99.7% | 94.8% exact / 96.7% within 1% | Most critical for reconciliation |
| Merchant name | 99.4% | 59.4% exact / 71.8% fuzzy (≥80) | Used for categorization |
| Date | 98.9% | 95.8% exact | DD/MM vs MM/DD ambiguity may inflate mismatches |

---

## Confidence Threshold Analysis

Two routing strategies compared side-by-side. **New (total_conf)** routes based on the total-field confidence only — matches the updated `orchestrate.py` logic. **Legacy (agg)** used the minimum confidence across all fields.

| Threshold | Textract alone (agg) | Accuracy (agg) | Textract alone (total_conf) | Accuracy (total_conf) | → Gemini fallback |
|-----------|--------------------:|---------------:|----------------------------:|----------------------:|------------------:|
| ≥ 70 | 95.7% (925) | 96.1% | 97.0% (938) | 96.2% | 3.0% (29) |
| ≥ 75 | 94.8% (917) | 96.4% | 96.5% (933) | 96.5% | 3.5% (34) |
| ≥ 80 | 93.9% (908) | 96.4% | 95.9% (927) | 96.4% | 4.1% (40) ← **current** |
| ≥ 85 | 91.5% (885) | 96.8% | 94.9% (918) | 96.9% | 5.1% (49) |
| ≥ 90 | 89.6% (866) | 97.0% | 93.6% (905) | 97.0% | 6.4% (62) |
| ≥ 95 | 85.1% (823) | 97.1% | 92.2% (892) | 97.2% | 7.8% (75) ← **recommended** |

---

## Total Amount Deep Dive

Total amount is the single most important field — a wrong total means a wrong journal entry.

| Outcome | Count | % of all receipts |
|---------|------:|------------------:|
| Exact match (±0.01) | 917 | 94.8% |
| Within 1% | 18 | 1.9% |
| Off 1–10% (small error) | 6 | 0.6% |
| Decimal-point error (~10×) | 0 | 0.0% |
| Completely wrong (>10%) | 23 | 2.4% |
| Not extracted at all | 3 | 0.3% |

> **Decimal-point errors** (e.g. extracting 17.00 instead of 170.00) are the highest-risk failure mode for accounting reconciliation. These are the cases where the LLM fallback must catch the error.

---

## Confidence Score Distribution

| Confidence range | Count | % of all | Total accuracy |
|-----------------|------:|---------:|---------------:|
| 0–50 | 8 | 0.8% | 75.0% |
| 50–70 | 34 | 3.5% | 64.7% |
| 70–80 | 17 | 1.8% | 82.4% |
| 80–90 | 42 | 4.3% | 83.3% |
| 90–95 | 43 | 4.4% | 95.3% |
| 95–99 | 165 | 17.1% | 96.4% |
| 99–100 | 658 | 68.0% | 97.3% |

---

## Worst Failures — High Confidence, Wrong Total

*These are the most dangerous cases: Textract was confident but extracted the wrong amount.*

| Receipt | Confidence | Extracted | Ground Truth | Error |
|---------|----------:|----------:|-------------:|-------|
| 170 | 100.0 | 103.00 | 108.00 | 4.6% off |
| 129 | 100.0 | 7.65 | 7.20 | 6.3% off |
| 347 | 100.0 | 50.00 | 33.90 | 47.5% off |
| 531 | 99.8 | 24.00 | 22.65 | 6.0% off |
| 640 | 99.7 | 12.40 | 21.60 | 42.6% off |
| 176 | 99.7 | 4.85 | 14.85 | 67.3% off |
| 191 | 99.7 | 5.00 | 5.80 | 13.8% off |
| 145 | 99.7 | 50.00 | 9.90 | 405.1% off |
| 639 | 99.6 | 3.90 | 25.60 | 84.8% off |
| 517 | 99.3 | 33.00 | 60.60 | 45.5% off |
| 592 | 99.3 | 150.00 | 130.00 | 15.4% off |
| 378 | 99.3 | 8.20 | — | — off |
| 951 | 99.2 | 35.20 | 85.20 | 58.7% off |
| 162 | 98.9 | 15.00 | 14.65 | 2.4% off |
| 161 | 97.5 | 100.00 | 23.00 | 334.8% off |
| 371 | 95.1 | 144688.68 | 153.35 | 94251.9% off |
| 496 | 85.4 | 51.50 | 41.45 | 24.2% off |
| 589 | 84.8 | 20.00 | 7.50 | 166.7% off |
| 739 | 82.2 | 76.30 | 78.30 | 2.6% off |
| 622 | 80.2 | 20.00 | 19.20 | 4.2% off |

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
| Total receipts | 967 |
| Textract API calls | 689 |
| Cache hits (saved calls) | 278 |
| Textract cost (AnalyzeExpense @ $0.0015/page) | $1.0335 |
| Processing time | 66m 41s |
