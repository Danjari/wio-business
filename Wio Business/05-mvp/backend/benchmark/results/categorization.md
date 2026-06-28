# Categorization Benchmark — Wio Business

**Generated:** 2026-06-28 23:07 UTC  
**Dataset:** 967 receipts (SROIE benchmark — Malaysia/Southeast Asia)  
**Methods compared:** Rule-based keyword matching vs Gemini Flash (batch, thinking disabled)  

---

## Executive Summary

**49.2% raw agreement**, but 40.3% of rules output was 'Other' (unclassified). Most disagreements (381/491) are the LLM resolving gaps the rules couldn't — not genuine conflicts. **Hybrid approach is the right call**: rules handle what they know, LLM handles the rest.

| Metric | Value |
|--------|-------|
| Receipts evaluated | 967 |
| Agreement | 476 / 967 (49.2%) |
| Disagreements (total) | 491 (50.8%) |
| — LLM fills rules gap (rules=Other) | 381 |
| — Genuine conflict (both had opinion) | 110 |
| LLM says 'Other' | 9 (0.9%) |
| Rules says 'Other' | 390 (40.3%) |

---

## Category Distribution

| Category | LLM count | LLM % | Rules count | Rules % |
|----------|----------:|------:|------------:|--------:|
| Fuel & Vehicle | 20 | 2.1% | 5 | 0.5% |
| Healthcare & Medical | 32 | 3.3% | 21 | 2.2% |
| Marketing & Advertising | 6 | 0.6% | 0 | 0.0% |
| Meals & Entertainment | 423 | 43.7% | 274 | 28.3% |
| Office & Stationery | 425 | 44.0% | 238 | 24.6% |
| Other | 9 | 0.9% | 390 | 40.3% |
| Professional Services | 0 | 0.0% | 16 | 1.7% |
| Rent & Facilities | 39 | 4.0% | 3 | 0.3% |
| Technology & Software | 2 | 0.2% | 1 | 0.1% |
| Travel & Transport | 10 | 1.0% | 12 | 1.2% |
| Utilities & Telecom | 1 | 0.1% | 7 | 0.7% |

---

## Disagreement Analysis

Of the 491 disagreements:

- **381 are gap-fills**: rules returned 'Other' (no keyword match), LLM assigned a specific category. LLM is almost certainly correct in these cases.
- **110 are genuine conflicts**: both methods had an opinion but differed. These need manual review to determine ground truth.

### Sample Disagreements

| Merchant | LLM | Rules | Type |
|----------|-----|-------|------|
| YONG CEN ENTERPRISE | Office & Stationery | Other | gap-fill |
| SYARIKAT PERNIAGAAN GIN KEE | Office & Stationery | Other | gap-fill |
| WARAKUYA PERMAS CITY SDN BHD | Meals & Entertainment | Other | gap-fill |
| MR. D.I.Y. (M) SDN BHD | Office & Stationery | Utilities & Telecom | conflict |
| PINGHWAI TRADING SDN BHD | Meals & Entertainment | Other | gap-fill |
| HUGO TRADING SDN BHD | Office & Stationery | Other | gap-fill |
| BHPETROL PERMAS JAYA 2 | Fuel & Vehicle | Other | gap-fill |
| UNIHAKKA INTERNATIONAL SDN BHD | Meals & Entertainment | Other | gap-fill |
| 99 SPEED MART S/B | Meals & Entertainment | Office & Stationery | conflict |
| ANN GIAP TRADING SDN BHD | Office & Stationery | Travel & Transport | conflict |
| POPULAR BOOK CO. (M) SDN BHD | Office & Stationery | Meals & Entertainment | conflict |
| UNIHAKKA INTERNATIONAL SDN BHD | Meals & Entertainment | Other | gap-fill |
| MR. D.I.Y. (M) SDN BHD | Office & Stationery | Other | gap-fill |
| KAISON FURNISHING SDN BHD | Office & Stationery | Professional Services | conflict |
| RSTORAN WAN SHENG | Meals & Entertainment | Other | gap-fill |
| SYARIKAT PERNIAGAAN GIN KEE | Rent & Facilities | Other | gap-fill |
| MR. D.I.Y. (M) SDN BHD | Office & Stationery | Other | gap-fill |
| MR. D.I.Y. (KUCHAI) SDN BHD | Office & Stationery | Other | gap-fill |
| POPULAR BOOK CO. (M) SDN BHD | Office & Stationery | Other | gap-fill |
| 99 SPEED MART S/B | Meals & Entertainment | Office & Stationery | conflict |
| UNIHAKKA INTERNATIONAL SDN BHD | Meals & Entertainment | Other | gap-fill |
| PASARAYA BORONG PINTAR SDN BHD | Office & Stationery | Other | gap-fill |
| HAI-O RAYA BHD | Healthcare & Medical | Other | gap-fill |
| MR. D.I.Y. (M) SDN BHD | Office & Stationery | Other | gap-fill |
| SYARIKAT PERNIAGAAN GIN KEE | Office & Stationery | Other | gap-fill |
| AMANO MALAYSIA SDN BHD | Travel & Transport | Other | gap-fill |
| KING'S CONFECTIONERY S/B | Meals & Entertainment | Other | gap-fill |
| PASARAYA JALAL SDN BHD | Office & Stationery | Other | gap-fill |
| SATU KAMPUNG ENTERPRISE SDN BHD | Office & Stationery | Rent & Facilities | conflict |
| KING'S CONFECTIONERY S/B | Meals & Entertainment | Other | gap-fill |

---

## Production Recommendation

**Use a hybrid pipeline:**

```
1. Run rule-based categorizer (free, <1ms, deterministic)
2. If result = 'Other' → call Gemini Flash with merchant + line items
3. Zoho Books sync uses whichever result is available
```

This covers 577/967 receipts with rules alone (59.7% rule coverage), and uses LLM only for the 390 unknowns.

| Approach | API calls | Estimated cost |
|----------|----------:|---------------:|
| All LLM | 967 | $0.2352 |
| Hybrid (LLM for unknowns only) | 390 | $0.0927 |
| Rules only | 0 | $0.0000 |

---

## Dataset Notes

- **SROIE caveat:** Malaysian/Southeast Asian merchants. UAE merchants (ADNOC, Carrefour, Talabat, Careem) will have higher rule-based coverage since they are recognisable brand names.
- **Rule-based 'Other' rate (40.3%)** is inflated by obscure Malaysian company names (e.g. 'SYARIKAT PERNIAGAAN GIN KEE'). Expect <15% 'Other' on UAE receipt traffic.
- **No ground truth categories** exist in SROIE — agreement metrics compare two methods, not accuracy vs a labeled set.
