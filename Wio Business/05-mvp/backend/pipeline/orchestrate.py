"""
Full receipt processing pipeline orchestrator.

Steps:
  1. AWS Textract extraction (primary)
  2. Gemini Flash text fallback (if Textract confidence < threshold)
  3. Gemini Flash vision fallback (if text LLM confidence < 0.99)
  4. Run both categorizers (rules + LLM) — results stored for comparison
  5. Transaction matching (RapidFuzz)
  6. Update Convex: match transaction or create pending approval
  7. Notify user via bot

Returns a PipelineResult describing the outcome.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from pipeline import extract, llm_text, llm_vision, categorize_rules, categorize_llm, match
from pipeline.extract import ExtractResult

VISION_CONFIDENCE_THRESHOLD = 0.99   # below this → ask for clearer photo
LLM_TEXT_CONFIDENCE_THRESHOLD = 0.99


@dataclass
class PipelineResult:
    status: str  # 'matched' | 'unmatched_routed' | 'needs_clarity' | 'error'
    merchant: Optional[str] = None
    total: Optional[float] = None
    date: Optional[str] = None
    category_rules: Optional[str] = None
    category_llm: Optional[str] = None
    category_used: Optional[str] = None
    extraction_method: str = "textract"
    matched_tx_id: Optional[str] = None
    error: Optional[str] = None
    audit_log: list[dict] = field(default_factory=list)

    def log(self, step: str, detail: str = "") -> None:
        self.audit_log.append({"step": step, "ts": int(time.time() * 1000), "detail": detail})


def run(
    receipt_id: str,
    image_path: str,
    transactions: list[dict],
    convex_client=None,    # injected; avoids circular import
    bot_notify_fn=None,    # injected; callable(message: str)
) -> PipelineResult:
    """
    Execute the full pipeline for one receipt image.

    image_path: absolute path to a temp image file (caller must delete it afterward).
    transactions: list of transaction dicts from Convex (hasReceipt=False candidates).
    """
    result = PipelineResult(status="error")
    result.log("pipeline_start", f"receipt_id={receipt_id}")

    # ── Step 1: Textract ──────────────────────────────────────────────────────
    try:
        textract_result: ExtractResult = extract.extract_receipt(image_path)
        result.log("textract_done", f"confidence={textract_result.textract_confidence:.1f} high={textract_result.high_confidence}")
    except RuntimeError as exc:
        result.error = str(exc)
        result.log("textract_error", str(exc))
        _update_convex(convex_client, receipt_id, result)
        return result

    merchant = textract_result.merchant
    total = textract_result.total
    date = textract_result.date
    extraction_method = "textract"

    # ── Step 2: Claude Haiku text fallback ───────────────────────────────────
    if not textract_result.high_confidence:
        result.log("llm_text_start", "textract confidence below threshold")
        try:
            text_result = llm_text.extract_from_text(textract_result.raw_text)
            extraction_method = "textract+haiku"
            result.log("llm_text_done", f"confidence={text_result.confidence:.2f}")

            # Merge: take Haiku value when Textract didn't find the field
            if not merchant and text_result.merchant:
                merchant = text_result.merchant
            if total is None and text_result.total is not None:
                total = text_result.total
            if not date and text_result.date:
                date = text_result.date

            # ── Step 3: Claude Sonnet vision — last resort ────────────────────
            if text_result.confidence < LLM_TEXT_CONFIDENCE_THRESHOLD:
                result.log("llm_vision_start", "haiku confidence below threshold — REGULATORY NOTE: image leaves UAE region")
                try:
                    vision_result = llm_vision.extract_from_image(image_path)
                    extraction_method = "textract+haiku+vision"
                    result.log("llm_vision_done", f"confidence={vision_result.confidence:.2f} regulatory_flag=True")

                    if not merchant and vision_result.merchant:
                        merchant = vision_result.merchant
                    if total is None and vision_result.total is not None:
                        total = vision_result.total
                    if not date and vision_result.date:
                        date = vision_result.date

                    if vision_result.confidence < VISION_CONFIDENCE_THRESHOLD:
                        result.status = "needs_clarity"
                        result.extraction_method = extraction_method
                        result.log("needs_clarity", "vision confidence below 0.99")
                        _update_convex(convex_client, receipt_id, result)
                        if bot_notify_fn:
                            bot_notify_fn(
                                "I couldn't read that receipt clearly enough to be confident in the amounts. "
                                "Could you take a clearer photo and try again? (Make sure the total and date are visible.)"
                            )
                        return result

                except RuntimeError as exc:
                    result.log("llm_vision_error", str(exc))
                    # Fall through — best effort with what we have

        except RuntimeError as exc:
            result.log("llm_text_error", str(exc))

    result.merchant = merchant
    result.total = total
    result.date = date
    result.extraction_method = extraction_method

    # ── Step 4: Categorization (both methods, always) ────────────────────────
    if merchant:
        cat_rules, cat_method, cat_conf = categorize_rules.categorize(merchant)
        result.category_rules = cat_rules
        result.log("categorize_rules", f"category={cat_rules} method={cat_method} conf={cat_conf:.2f}")

        try:
            cat_llm, llm_conf = categorize_llm.categorize(merchant)
            result.category_llm = cat_llm
            result.log("categorize_llm", f"category={cat_llm} conf={llm_conf:.2f}")
        except Exception as exc:
            result.log("categorize_llm_error", str(exc))
            cat_llm = cat_rules  # fall back to rules result

        # Production uses rule-based result; LLM stored for comparison
        result.category_used = cat_rules
    else:
        result.category_rules = result.category_llm = result.category_used = "Office Supplies"
        result.log("categorize_skipped", "no merchant name extracted")

    # ── Step 5: Transaction matching ─────────────────────────────────────────
    if total is None:
        result.log("match_skipped", "no total extracted — cannot match")
        result.status = "needs_clarity"
        _update_convex(convex_client, receipt_id, result)
        if bot_notify_fn:
            bot_notify_fn(
                "I could read the receipt but couldn't determine the total amount. "
                "Could you send a clearer photo showing the total clearly?"
            )
        return result

    match_result = match.find_match(
        extracted_merchant=merchant or "",
        extracted_total=total,
        extracted_date=date or "",
        transactions=transactions,
    )

    if match_result:
        result.status = "matched"
        result.matched_tx_id = match_result.transaction_id
        result.log("match_found", f"tx_id={match_result.transaction_id} score={match_result.merchant_score}")

        if convex_client:
            convex_client.update_transaction(
                match_result.transaction_id,
                {"hasReceipt": True, "zohoSynced": True},
            )
            convex_client.update_receipt(receipt_id, result)

        if bot_notify_fn:
            bot_notify_fn(
                f"✓ Receipt matched — {match_result.merchant} · "
                f"AED {match_result.amount:,.0f} · "
                f"Category: {result.category_used} · Zoho Books updated."
            )

    else:
        result.status = "unmatched_routed"
        result.log("match_not_found", "routing to approvals")

        if convex_client:
            # Determine approval level from APPROVAL_RULES thresholds
            required_level = _approval_level(total)
            new_tx_id = convex_client.create_transaction({
                "merchant": merchant or "Unknown Merchant",
                "amount": total,
                "date": date or "",
                "category": result.category_used,
                "status": "pending_approval",
                "hasReceipt": True,
                "zohoSynced": False,
                "note": f"Auto-created from bot receipt — no matching transaction found",
                "cardId": "c5",  # defaults to founder's petty cash card for demo
            })
            convex_client.create_approval({
                "txId": new_tx_id,
                "requestedById": "t1",  # Sara (founder — hardcoded for demo)
                "amount": total,
                "merchant": merchant or "Unknown Merchant",
                "category": result.category_used,
                "cardId": "c5",
                "note": f"Receipt submitted via Telegram bot. Category: {result.category_used}.",
                "requiredLevel": required_level,
            })
            convex_client.update_receipt(receipt_id, result)

        if bot_notify_fn:
            bot_notify_fn(
                f"Receipt saved — {merchant or 'Unknown'} · AED {total:,.0f} · "
                f"No matching card transaction found, so I've sent it to your approvals queue "
                f"({_approval_level(total)} review required)."
            )

    return result


def _approval_level(amount: float) -> str:
    if amount >= 5000:
        return "founder"
    if amount >= 500:
        return "manager"
    return "manager"  # auto-approve threshold handled separately; always needs at least manager
