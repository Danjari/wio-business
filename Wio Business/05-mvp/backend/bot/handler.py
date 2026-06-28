"""
Telegram bot message handler.

Receives photo messages from Telegram, downloads the highest-resolution version,
and dispatches to the processing pipeline.

Bot identity: all receipts are attributed to Sara (founder, t1) for the demo.
Phase 2 will add /register to map Telegram user IDs to team members.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from pathlib import Path

import httpx

from bot import notify
from convex_client import ConvexClient

logger = logging.getLogger(__name__)

_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_FILE_API = f"https://api.telegram.org/bot{_BOT_TOKEN}"
_CDN = f"https://api.telegram.org/file/bot{_BOT_TOKEN}"

# Demo: all receipts attributed to Sara (founder)
_DEMO_TEAM_MEMBER_ID = "t1"


def handle_update(update: dict, convex: ConvexClient) -> None:
    """
    Process a single Telegram update object.
    Called by the FastAPI webhook endpoint for each incoming update.
    """
    message = update.get("message") or update.get("channel_post")
    if not message:
        return

    chat_id = message["chat"]["id"]

    # Only handle photo messages
    photos = message.get("photo")
    if not photos:
        if "text" in message:
            _handle_text(message, chat_id)
        return

    notify.send_message(chat_id, "📄 Got it! Processing your receipt...")

    # Download the highest-resolution photo (last in the array)
    best_photo = photos[-1]
    file_id = best_photo["file_id"]

    image_path = None
    try:
        image_path = _download_photo(file_id)

        # Create receipt record in Convex
        receipt_id = convex.create_receipt({
            "botSource": "telegram",
            "botUserId": str(message["from"]["id"]),
            "teamMemberId": _DEMO_TEAM_MEMBER_ID,
            "currency": "AED",
            "status": "pending_extraction",
            "createdAt": int(time.time() * 1000),
            "auditLog": [],
        })

        # Fetch transaction pool for matching
        try:
            transactions = convex.get_unreceipted_transactions()
        except Exception as exc:
            logger.warning(f"Could not fetch transactions from Convex: {exc}. Using empty list.")
            transactions = []

        # Import here to avoid circular imports at module load
        from pipeline import orchestrate

        def _notify(msg: str) -> None:
            notify.send_message(chat_id, msg)

        orchestrate.run(
            receipt_id=receipt_id,
            image_path=image_path,
            transactions=transactions,
            convex_client=convex,
            bot_notify_fn=_notify,
        )

    except Exception as exc:
        logger.exception(f"Pipeline error for chat {chat_id}: {exc}")
        notify.send_message(
            chat_id,
            "Something went wrong processing your receipt. Please try again, or contact support.",
        )
    finally:
        # Always delete the temp image — regulatory requirement
        if image_path and Path(image_path).exists():
            Path(image_path).unlink(missing_ok=True)


def _download_photo(file_id: str) -> str:
    """Download a Telegram photo to a temp file. Returns the file path."""
    # Step 1: get the file path on Telegram's CDN
    resp = httpx.get(f"{_FILE_API}/getFile", params={"file_id": file_id}, timeout=15.0)
    resp.raise_for_status()
    file_path = resp.json()["result"]["file_path"]

    # Step 2: download the image bytes
    img_resp = httpx.get(f"{_CDN}/{file_path}", timeout=30.0)
    img_resp.raise_for_status()

    # Step 3: write to a named temp file (jpg)
    suffix = Path(file_path).suffix or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(img_resp.content)
    tmp.close()
    return tmp.name


def _handle_text(message: dict, chat_id: int) -> None:
    text = (message.get("text") or "").strip()
    if text.lower() == "/start":
        notify.send_message(
            chat_id,
            "👋 Hi! Send me a photo of your receipt and I'll extract, categorize, "
            "and match it to your Wio Business transactions automatically.\n\n"
            "<b>Note:</b> This demo attributes all receipts to Sara (founder). "
            "Team member registration coming soon.",
        )
    elif text.lower() == "/help":
        notify.send_message(
            chat_id,
            "Send any receipt photo to this bot. I'll:\n"
            "1. Extract merchant, amount, and date via AWS Textract\n"
            "2. Categorize the expense\n"
            "3. Match it to an existing card transaction, or create an approval request if none found.",
        )
