-- Wio Business Spend Management — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── Team members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team (
  id          TEXT PRIMARY KEY,   -- 't1', 't2', etc. — matches frontend data.ts
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  initials    TEXT NOT NULL,
  is_founder  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Cards ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  holder_id   TEXT NOT NULL REFERENCES team(id),
  label       TEXT NOT NULL,
  last4       TEXT NOT NULL,
  limit_aed   INTEGER NOT NULL,
  spent       INTEGER NOT NULL DEFAULT 0,
  categories  TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen'))
);

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES cards(id),
  merchant    TEXT NOT NULL,
  category    TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'approved'
                CHECK (status IN ('approved', 'pending_approval', 'declined', 'out_of_policy')),
  has_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  zoho_synced BOOLEAN NOT NULL DEFAULT FALSE,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_has_receipt ON transactions (has_receipt, status);

-- ── Approvals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id            TEXT NOT NULL REFERENCES transactions(id),
  requested_by_id  TEXT NOT NULL REFERENCES team(id),
  amount           NUMERIC(12, 2) NOT NULL,
  merchant         TEXT NOT NULL,
  category         TEXT NOT NULL,
  card_id          TEXT NOT NULL REFERENCES cards(id),
  note             TEXT,
  date             DATE NOT NULL,
  required_level   TEXT NOT NULL CHECK (required_level IN ('manager', 'founder')),
  outcome          TEXT CHECK (outcome IN ('approved', 'declined')),
  processed_at     TIMESTAMPTZ
);

-- ── Receipts (bot-ingested) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_source           TEXT NOT NULL DEFAULT 'telegram',
  bot_user_id          TEXT NOT NULL,
  team_member_id       TEXT REFERENCES team(id),
  extraction_method    TEXT,          -- 'textract' | 'textract+gemini_text' | 'textract+gemini_vision'
  merchant             TEXT,
  amount               NUMERIC(12, 2),
  currency             TEXT NOT NULL DEFAULT 'AED',
  date                 TEXT,          -- stored as-extracted string; normalised in application layer
  category_rules       TEXT,
  category_llm         TEXT,
  category_used        TEXT,
  textract_confidence  FLOAT,
  final_confidence     FLOAT,
  status               TEXT NOT NULL DEFAULT 'pending_extraction'
                         CHECK (status IN ('pending_extraction', 'needs_clarity', 'matched', 'unmatched_routed', 'error')),
  matched_tx_id        TEXT REFERENCES transactions(id),
  audit_log            JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts (status);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts (created_at DESC);
