"""
Slack bot event handler.

Receives message events (with image attachments) via Slack Socket Mode,
downloads the file, and dispatches to the processing pipeline.

Bot identity: all receipts are attributed to Sara (founder, t1) for the demo.

File download note: url_private_download with a user token (xoxe.xoxp-) works via
direct Bearer auth even though bot tokens fail on the same URL (redirect chain rejects
bot tokens but accepts user tokens). files.sharedPublicURL is not used — it requires
public file sharing to be enabled at the workspace admin level.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import httpx

from db_client import SupabaseClient

logger = logging.getLogger(__name__)

_DEMO_TEAM_MEMBER_ID = "t1"
_USER_TOKEN = os.getenv("SLACK_USER_TOKEN", "")


def handle_event(event: dict, say, client, db: SupabaseClient | None) -> None:
    """
    Process a single Slack message event.
    Called by the Slack Bolt app for each incoming message event.
    """
    logger.info(f"Event received — type={event.get('type')} subtype={event.get('subtype')} "
                f"bot_id={event.get('bot_id')} user={event.get('user')} "
                f"files={len(event.get('files', []))} text={repr((event.get('text') or '')[:60])}")

    if event.get("bot_id") or event.get("subtype") == "bot_message":
        logger.info("Skipping bot message")
        return

    files = event.get("files", [])
    image_files = [f for f in files if f.get("mimetype", "").startswith("image/")]
    logger.info(f"Files: {len(files)} total, {len(image_files)} images")

    if not image_files:
        _handle_text((event.get("text") or "").strip(), say)
        return

    say("📄 Got it! Processing your receipt...")

    image_path = None
    try:
        file_id = image_files[0]["id"]
        image_path = _download_file(file_id, client)

        receipt_id = "demo"
        if db:
            receipt_id = db.create_receipt({
                "bot_source": "slack",
                "bot_user_id": event.get("user", "unknown"),
                "team_member_id": _DEMO_TEAM_MEMBER_ID,
                "currency": "AED",
                "status": "pending_extraction",
                "audit_log": [],
            })

        try:
            transactions = db.get_unreceipted_transactions() if db else []
        except Exception as exc:
            logger.warning(f"Could not fetch transactions: {exc}. Using empty list.")
            transactions = []

        from pipeline import orchestrate

        orchestrate.run(
            receipt_id=receipt_id,
            image_path=image_path,
            transactions=transactions,
            db=db,
            bot_notify_fn=say,
        )

    except Exception as exc:
        logger.exception(f"Pipeline error: {exc}")
        say("Something went wrong processing your receipt. Please try again.")
    finally:
        if image_path and Path(image_path).exists():
            Path(image_path).unlink(missing_ok=True)


def _download_file(file_id: str, slack_client) -> str:
    """
    Download a Slack file using direct Bearer-token auth.

    files.sharedPublicURL is blocked (workspace has public sharing disabled).
    url_private_download with a bot token redirects through a workspace subdomain
    that only accepts cookie auth — but a user token (xoxp-/xoxe.xoxp-) is accepted
    by that redirect chain because the user owns the file. Try user token first,
    fall back to bot token in case the workspace configuration differs.
    """
    info = slack_client.files_info(file=file_id)
    url = info["file"].get("url_private_download") or info["file"].get("url_private")
    if not url:
        raise RuntimeError("No download URL returned by files.info")

    tokens_to_try = [t for t in [_USER_TOKEN, slack_client.token] if t]
    last_error: Exception | None = None

    for token in tokens_to_try:
        try:
            resp = httpx.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                follow_redirects=True,
                timeout=30.0,
            )
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" in content_type:
                last_error = RuntimeError(f"Got HTML with token ending ...{token[-6:]}")
                continue
            suffix = ".png" if "png" in content_type else ".pdf" if "pdf" in content_type else ".jpg"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(resp.content)
            tmp.close()
            return tmp.name
        except Exception as exc:
            last_error = exc
            logger.warning(f"Download attempt with token ending ...{token[-6:]} failed: {exc}")

    raise RuntimeError(f"All download attempts failed. Last error: {last_error}")


def _handle_text(text: str, say) -> None:
    if text.lower() in ("/start", "hi", "hello", "help", "/help"):
        say(
            "👋 Hi! Send me a photo of your receipt and I'll extract, categorize, "
            "and match it to your Wio Business transactions automatically.\n\n"
            "_Note: This demo attributes all receipts to Sara (founder). "
            "Team member registration coming soon._"
        )
