"""
Supabase database client.

Uses the service role key (bypasses Row Level Security) — appropriate for this
Python backend which runs server-side and is never exposed to end users.

The frontend will use the anon key + RLS-enforced policies (Phase 2).
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

from supabase import create_client, Client


def _get_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


class SupabaseClient:
    def __init__(self) -> None:
        self._db: Client = _get_client()

    # ── Receipts ──────────────────────────────────────────────────────────────

    def create_receipt(self, data: dict) -> str:
        """Insert a new receipt row. Returns the UUID as a string."""
        resp = self._db.table("receipts").insert(data).execute()
        return str(resp.data[0]["id"])

    def update_receipt(self, receipt_id: str, fields: dict) -> None:
        self._db.table("receipts").update(fields).eq("id", receipt_id).execute()

    def is_duplicate_receipt(self, slack_file_id: str) -> bool:
        """Return True if a receipt with this Slack file ID was already processed."""
        resp = (
            self._db.table("receipts")
            .select("id")
            .eq("slack_file_id", slack_file_id)
            .neq("status", "error")
            .limit(1)
            .execute()
        )
        return len(resp.data or []) > 0

    # ── Transactions ──────────────────────────────────────────────────────────

    def get_unreceipted_transactions(self) -> list[dict]:
        """Return approved/pending_approval transactions that are missing a receipt."""
        resp = (
            self._db.table("transactions")
            .select("*")
            .eq("has_receipt", False)
            .in_("status", ["approved", "pending_approval"])
            .execute()
        )
        return resp.data or []

    def update_transaction(self, tx_id: str, fields: dict) -> None:
        self._db.table("transactions").update(fields).eq("id", tx_id).execute()

    def create_transaction(self, data: dict) -> str:
        if "id" not in data:
            data = {"id": f"tx_{uuid.uuid4().hex[:12]}", **data}
        resp = self._db.table("transactions").insert(data).execute()
        return str(resp.data[0]["id"])

    # ── Approvals ─────────────────────────────────────────────────────────────

    def create_approval(self, data: dict) -> str:
        resp = self._db.table("approvals").insert(data).execute()
        return str(resp.data[0]["id"])
