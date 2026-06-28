# Backend Plan — Wio Business Receipt Ingestion

Full plan: `~/.claude/plans/we-will-build-the-resilient-hammock.md`

## What this builds

A Python FastAPI service that:
1. Receives receipt photos from a Telegram bot
2. Extracts fields via AWS Textract (primary) → Gemini Flash text (fallback) → Gemini Flash vision (last resort)
3. Categorizes via two independent methods: rule-based (keyword dict + TF-IDF) and LLM (Gemini Flash)
4. Matches the receipt to an existing `has_receipt: false` transaction in Supabase, or routes to Approvals if no match

## Directory layout

```
backend/
  main.py                    — FastAPI app; mounts /webhook
  db_client.py               — Supabase Python client wrapper (service role)
  bot/
    handler.py               — python-telegram-bot message handler
    notify.py                — send replies back to Telegram user
  pipeline/
    orchestrate.py           — full pipeline orchestration
    extract.py               — AWS Textract receipt mode
    llm_text.py              — Gemini Flash text fallback
    llm_vision.py            — Gemini Flash vision last resort
    categorize_llm.py        — LLM-based categorizer
    categorize_rules.py      — Rule-based categorizer (keyword + TF-IDF)
    merchant_categories.json — keyword → category mapping
    match.py                 — fuzzy match against transaction pool
  supabase/
    schema.sql               — CREATE TABLE statements; run in Supabase SQL editor
    seed.sql                 — INSERT seed data (mirrors frontend data.ts)
  benchmark/
    run_extraction.py        — compare Textract vs fullDataset/gdt ground truth
    run_categorization.py    — LLM vs rule-based agreement on 967 merchant names
    label_subset.py          — CLI to manually label receipts for TF-IDF training
    metrics.py               — shared accuracy/agreement computation
    report.py                — print + save JSON reports
```

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in credentials
```

Required environment variables (see `.env.example`):
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Settings → API
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=me-south-1`
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

## Database setup

1. Go to Supabase dashboard → SQL Editor → New query
2. Run `supabase/schema.sql` to create tables
3. Run `supabase/seed.sql` to populate seed data (safe to re-run — uses ON CONFLICT DO NOTHING)

## Run dev server

```bash
uvicorn main:app --reload --port 8000
# Then expose via ngrok: ngrok http 8000
# Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<NGROK_URL>/webhook
```

## Run benchmarks

```bash
# Extraction accuracy vs ground truth (needs AWS credentials)
python -m benchmark.run_extraction --dataset ../fullDataset --output benchmark/results/extraction.json

# Categorization agreement (needs GEMINI_API_KEY for LLM method)
python -m benchmark.run_categorization --dataset ../fullDataset --output benchmark/results/categorization.json

# Build TF-IDF training data (interactive labeling)
python -m benchmark.label_subset --dataset ../fullDataset --n 150
```

## Pipeline confidence thresholds

| Stage | Threshold | Action |
|---|---|---|
| Textract field confidence | < 80 (Textract 0-100 scale) | Trigger Gemini Flash text fallback |
| Gemini Flash text confidence | < 0.99 | Trigger Gemini Flash vision |
| Gemini Flash vision confidence | < 0.99 | Ask user for clearer photo |
| Transaction match score | < 0.70 | Route to Approvals |

## Regulatory notes

- Raw receipt images deleted from disk immediately after Textract call (in `finally` block)
- Images not stored in Supabase — only extracted structured fields
- If vision LLM fallback triggers, image data leaves UAE — flagged in `llm_vision.py` + audit log
- All steps logged to `receipts.audit_log` (JSONB) in Supabase
