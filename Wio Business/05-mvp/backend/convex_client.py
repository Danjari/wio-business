"""
Thin HTTP wrapper for the Convex HTTP API.

Convex doesn't have an official Python client — we use the Convex HTTP API
(https://docs.convex.dev/http-api) with httpx.

All mutation/query names map to convex/receipts.ts, convex/transactions.ts, etc.
(those files need to be created in the Convex project alongside this backend).

CONVEX_URL and CONVEX_DEPLOY_KEY must be set in .env.
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

_CONVEX_URL = os.getenv("CONVEX_URL", "")
_DEPLOY_KEY = os.getenv("CONVEX_DEPLOY_KEY", "")

# Retry settings for transient network errors
_MAX_RETRIES = 3
_RETRY_DELAY = 0.5


class ConvexClient:
    def __init__(self, url: str = _CONVEX_URL, deploy_key: str = _DEPLOY_KEY):
        if not url:
            raise RuntimeError("CONVEX_URL is not set")
        self._base = url.rstrip("/")
        self._headers = {
            "Authorization": f"Convex {deploy_key}",
            "Content-Type": "application/json",
        }

    # ── Receipts ──────────────────────────────────────────────────────────────

    def create_receipt(self, data: dict) -> str:
        """Insert a new receipt record. Returns the Convex document ID."""
        return self._mutation("receipts:create", data)

    def update_receipt(self, receipt_id: str, pipeline_result) -> None:
        """Update a receipt record with the pipeline result."""
        from pipeline.orchestrate import PipelineResult
        pr: PipelineResult = pipeline_result
        self._mutation("receipts:update", {
            "id": receipt_id,
            "status": pr.status,
            "merchant": pr.merchant,
            "amount": pr.total,
            "date": pr.date,
            "categoryRules": pr.category_rules,
            "categoryLlm": pr.category_llm,
            "categoryUsed": pr.category_used,
            "extractionMethod": pr.extraction_method,
            "matchedTransactionId": pr.matched_tx_id,
            "auditLog": pr.audit_log,
        })

    # ── Transactions ──────────────────────────────────────────────────────────

    def get_unreceipted_transactions(self) -> list[dict]:
        """Return all transactions where hasReceipt is False."""
        return self._query("transactions:listUnreceipted")

    def update_transaction(self, tx_id: str, fields: dict) -> None:
        self._mutation("transactions:update", {"id": tx_id, **fields})

    def create_transaction(self, data: dict) -> str:
        """Insert a new transaction. Returns the Convex document ID."""
        return self._mutation("transactions:create", data)

    # ── Approvals ─────────────────────────────────────────────────────────────

    def create_approval(self, data: dict) -> str:
        return self._mutation("approvals:create", data)

    # ── Seed (one-time) ───────────────────────────────────────────────────────

    def seed_initial_data(self, seed_data: dict) -> None:
        """Push INITIAL_* data from data.ts into Convex. Run once."""
        self._mutation("seed:run", seed_data)

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _mutation(self, name: str, args: dict) -> Any:
        return self._post("mutation", name, args)

    def _query(self, name: str, args: dict | None = None) -> Any:
        return self._post("query", name, args or {})

    def _post(self, endpoint_type: str, name: str, args: dict) -> Any:
        url = f"{self._base}/api/{endpoint_type}"
        payload = {"path": name, "args": args}

        for attempt in range(_MAX_RETRIES):
            try:
                resp = httpx.post(url, json=payload, headers=self._headers, timeout=15.0)
                resp.raise_for_status()
                data = resp.json()
                # Convex HTTP API wraps the result
                if "value" in data:
                    return data["value"]
                return data
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code < 500 or attempt == _MAX_RETRIES - 1:
                    raise RuntimeError(
                        f"Convex {endpoint_type} '{name}' failed: {exc.response.text}"
                    ) from exc
            except httpx.RequestError as exc:
                if attempt == _MAX_RETRIES - 1:
                    raise RuntimeError(f"Convex request error: {exc}") from exc
            time.sleep(_RETRY_DELAY * (attempt + 1))
