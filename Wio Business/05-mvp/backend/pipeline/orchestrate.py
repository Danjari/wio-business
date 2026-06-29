"""
Full receipt processing pipeline orchestrator.

Steps:
  1. AWS Textract extraction (primary)
  2. Gemini Flash text fallback (if Textract confidence < threshold)
  3. Gemini Flash vision fallback (if text LLM confidence < 0.99)
  4. Run both categorizers (rules + LLM) — results stored for comparison
  5. Transaction matching (RapidFuzz)
  6. Update Supabase: match transaction or create pending approval
  7. Notify user via bot

Returns a PipelineResult describing the outcome.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from pipeline import extract, llm_text, llm_vision, categorize_rules, categorize_llm, match
from pipeline.extract import ExtractResult

VISION_CONFIDENCE_THRESHOLD = 0.99
LLM_TEXT_CONFIDENCE_THRESHOLD = 0.99
# Textract must meet this per-field total confidence to skip the text LLM fallback.
# Below this threshold, or when total is entirely absent, text fallback runs.
TOTAL_CONFIDENCE_THRESHOLD = 80.0


@dataclass
class PipelineResult:
    status: str  # 'matched' | 'unmatched_routed' | 'needs_clarity' | 'error'
    merchant: Optional[str] = None
    total: Optional[float] = None
    currency: Optional[str] = None
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


def _normalize_date(date_str: str) -> str:
    """Convert any extracted date format to ISO YYYY-MM-DD for Supabase."""
    if not date_str:
        return date_str
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y",
                "%d %b %Y", "%b %d, %Y", "%d %B %Y", "%B %d, %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def run(
    receipt_id: str,
    image_path: str,
    transactions: list[dict],
    db=None,              # SupabaseClient instance; injected to avoid circular import
    bot_notify_fn=None,   # callable(message: str)
) -> PipelineResult:
    """
    Execute the full pipeline for one receipt image.

    image_path: absolute path to a temp file (caller must delete it after this returns).
    transactions: list of transaction rows from Supabase (has_receipt=False candidates).
    """
    result = PipelineResult(status="error")
    result.log("pipeline_start", f"receipt_id={receipt_id}")

    # ── Step 1: Textract ──────────────────────────────────────────────────────
    textract_failed = False
    textract_result: Optional[ExtractResult] = None
    try:
        textract_result = extract.extract_receipt(image_path)
        result.log("textract_done", f"confidence={textract_result.textract_confidence:.1f} high={textract_result.high_confidence}")
    except RuntimeError as exc:
        result.log("textract_error", str(exc))
        textract_failed = True

    merchant = textract_result.merchant if textract_result else None
    total = textract_result.total if textract_result else None
    date = textract_result.date if textract_result else None
    extraction_method = "textract" if not textract_failed else "gemini_vision"

    # ── Early rejection: clearly not a receipt ───────────────────────────────
    if (
        not textract_failed
        and textract_result is not None
        and textract_result.merchant is None
        and textract_result.total is None
        and textract_result.date is None
    ):
        result.status = "error"
        result.error = "not_a_receipt"
        result.log("rejected", "Textract found no receipt fields — image is not a receipt")
        _save(db, receipt_id, result)
        if bot_notify_fn:
            bot_notify_fn(
                "That doesn't look like a receipt — I couldn't find a merchant, amount, or date. "
                "Please send a clear photo of an expense receipt."
            )
        return result

    # ── Step 2: Gemini Flash text fallback ────────────────────────────────────
    # Trigger when: Textract has no total OR total confidence is below threshold.
    # Merchant/date issues alone do NOT trigger this — only missing/low-confidence total.
    # Skip entirely if Textract failed (no raw_text) — fall through to vision below.
    needs_text_fallback = (
        not textract_failed
        and textract_result is not None
        and (
            textract_result.total is None
            or textract_result.total_confidence < TOTAL_CONFIDENCE_THRESHOLD
        )
    )
    if needs_text_fallback:
        result.log(
            "llm_text_start",
            f"total={'missing' if textract_result.total is None else 'low-conf'} "
            f"total_conf={textract_result.total_confidence:.1f}",
        )
        try:
            text_result = llm_text.extract_from_text(textract_result.raw_text)
            extraction_method = "textract+gemini_text"
            result.log("llm_text_done", f"confidence={text_result.confidence:.2f}")

            if not merchant and text_result.merchant:
                merchant = text_result.merchant
            if total is None and text_result.total is not None:
                total = text_result.total
            if not date and text_result.date:
                date = text_result.date

            # ── Step 3: Gemini Flash vision — last resort ─────────────────────
            # Only escalate to vision when the total is STILL missing after text fallback.
            # Don't burn a vision call just because merchant or date are uncertain.
            if total is None:
                result.log("llm_vision_start", "total still missing after text fallback — REGULATORY NOTE: image leaves UAE region")
                try:
                    vision_result = llm_vision.extract_from_image(image_path)
                    extraction_method = "textract+gemini_text+gemini_vision"
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
                        _save(db, receipt_id, result)
                        if bot_notify_fn:
                            bot_notify_fn(
                                "I couldn't read that receipt clearly enough to be confident in the amounts. "
                                "Could you take a clearer photo and try again? (Make sure the total and date are visible.)"
                            )
                        return result

                except RuntimeError as exc:
                    result.log("llm_vision_error", str(exc))

        except RuntimeError as exc:
            result.log("llm_text_error", str(exc))

    # ── Textract unavailable — go direct to Gemini Vision ────────────────────
    if textract_failed:
        result.log("llm_vision_start", "textract unavailable — using Gemini Vision directly")
        try:
            vision_result = llm_vision.extract_from_image(image_path)
            extraction_method = "gemini_vision"
            result.log("llm_vision_done", f"confidence={vision_result.confidence:.2f}")
            merchant = vision_result.merchant
            total = vision_result.total
            date = vision_result.date
            if vision_result.confidence < VISION_CONFIDENCE_THRESHOLD:
                result.status = "needs_clarity"
                result.extraction_method = extraction_method
                result.log("needs_clarity", "vision confidence below 0.99")
                _save(db, receipt_id, result)
                if bot_notify_fn:
                    bot_notify_fn(
                        "I couldn't read that receipt clearly enough. "
                        "Could you take a clearer photo showing the total and date?"
                    )
                return result
        except RuntimeError as exc:
            result.error = str(exc)
            result.log("llm_vision_error", str(exc))
            _save(db, receipt_id, result)
            if bot_notify_fn:
                bot_notify_fn("Could not process that receipt. Please try again.")
            return result

    date = _normalize_date(date or "") or None
    result.merchant = merchant
    result.total = total
    result.currency = (textract_result.currency if textract_result else None) or "AED"
    result.date = date
    result.extraction_method = extraction_method

    # ── Step 4: Categorization (both methods, always) ────────────────────────
    line_items = textract_result.line_items if textract_result else []
    if merchant:
        cat_rules, cat_method, cat_conf = categorize_rules.categorize(merchant, items=line_items)
        result.category_rules = cat_rules
        result.log("categorize_rules", f"category={cat_rules} method={cat_method} conf={cat_conf:.2f} items={len(line_items)}")

        try:
            cat_llm, llm_conf = categorize_llm.categorize(merchant, items=line_items)
            result.category_llm = cat_llm
            result.log("categorize_llm", f"category={cat_llm} conf={llm_conf:.2f}")
        except Exception as exc:
            result.log("categorize_llm_error", str(exc))
            cat_llm = cat_rules

        result.category_used = cat_llm
    else:
        result.category_rules = result.category_llm = result.category_used = "Other"
        result.log("categorize_skipped", "no merchant name extracted")

    # ── Step 5: Transaction matching ─────────────────────────────────────────
    if total is None:
        result.log("match_skipped", "no total extracted — cannot match")
        result.status = "needs_clarity"
        _save(db, receipt_id, result)
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
        extracted_currency=result.currency or "AED",
    )

    if match_result:
        result.status = "matched"
        result.matched_tx_id = match_result.transaction_id
        result.log("match_found", f"tx_id={match_result.transaction_id} score={match_result.merchant_score}")

        if db:
            db.update_transaction(
                match_result.transaction_id,
                {"has_receipt": True, "zoho_synced": True},
            )
            _save(db, receipt_id, result)

        if bot_notify_fn:
            bot_notify_fn(
                f"✓ Receipt matched — {match_result.merchant} · "
                f"{result.currency} {match_result.amount:,.2f} · "
                f"Category: {result.category_used} · Zoho Books updated."
            )

    else:
        result.status = "unmatched_routed"
        result.log("match_not_found", "routing to approvals")

        if db:
            required_level = _approval_level(total)
            new_tx_id = db.create_transaction({
                "merchant": merchant or "Unknown Merchant",
                "amount": total,
                "currency": result.currency or "AED",
                "date": date or "",
                "category": result.category_used,
                "status": "pending_approval",
                "has_receipt": True,
                "zoho_synced": False,
                "note": "Auto-created from Slack bot receipt — no matching transaction found",
                "card_id": "c5",  # founder's petty cash card — demo default
            })
            db.create_approval({
                "tx_id": new_tx_id,
                "requested_by_id": "t1",  # Sara (founder — hardcoded for demo)
                "amount": total,
                "merchant": merchant or "Unknown Merchant",
                "category": result.category_used,
                "card_id": "c5",
                "note": f"Receipt submitted via Slack bot. Category: {result.category_used}.",
                "date": date or "",
                "required_level": required_level,
            })
            _save(db, receipt_id, result)

        if bot_notify_fn:
            bot_notify_fn(
                f"Receipt saved — {merchant or 'Unknown'} · {result.currency} {total:,.2f} · "
                f"No matching card transaction found, so I've sent it to your approvals queue "
                f"({_approval_level(total)} review required)."
            )

    return result


def _save(db, receipt_id: str, result: PipelineResult) -> None:
    if not db:
        return
    db.update_receipt(receipt_id, {
        "status": result.status,
        "merchant": result.merchant,
        "amount": result.total,
        "currency": result.currency,
        "date": result.date,
        "category_rules": result.category_rules,
        "category_llm": result.category_llm,
        "category_used": result.category_used,
        "extraction_method": result.extraction_method,
        "matched_tx_id": result.matched_tx_id,
        "audit_log": result.audit_log,
    })


def _approval_level(amount: float) -> str:
    if amount >= 5000:
        return "founder"
    return "manager"
