"""
Slack bot event handler.

Receives message events (with image attachments) via Slack Socket Mode,
downloads the file using the bot token as bearer auth, and dispatches
to the processing pipeline.

Bot identity: all receipts are attributed to Sara (founder, t1) for the demo.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import httpx

from db_client import SupabaseClient

logger = logging.getLogger(__name__)

_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")

_DEMO_TEAM_MEMBER_ID = "t1"


def handle_event(event: dict, say, db: SupabaseClient | None) -> None:
    """
    Process a single Slack message event.
    Called by the Slack Bolt app for each incoming message event.
    """
    # Ignore bot messages to prevent loops
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return

    files = event.get("files", [])
    image_files = [f for f in files if f.get("mimetype", "").startswith("image/")]

    if not image_files:
        _handle_text((event.get("text") or "").strip(), say)
        return

    say("📄 Got it! Processing your receipt...")

    image_path = None
    try:
        file_url = image_files[0]["url_private_download"]
        image_path = _download_file(file_url)

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


def _download_file(url: str) -> str:
    """Download a Slack file using the bot token. Returns temp file path.

    Slack's redirect chain crosses domains (files.slack.com → workspace subdomain).
    httpx strips Authorization on cross-domain redirects by default. Using a request
    event hook ensures the Bearer token is injected on every request in the chain,
    including all redirected ones, regardless of destination domain.
    """
    def _inject_auth(request: httpx.Request) -> None:
        request.headers["Authorization"] = f"Bearer {_BOT_TOKEN}"

    with httpx.Client(
        event_hooks={"request": [_inject_auth]},
        follow_redirects=True,
        timeout=30.0,
    ) as client:
        resp = client.get(url)

    resp.raise_for_status()

    content_type = resp.headers.get("content-type", "")
    if "text/html" in content_type:
        raise RuntimeError("Slack returned HTML instead of image — check SLACK_BOT_TOKEN and files:read scope")

    suffix = ".png" if "png" in content_type else ".pdf" if "pdf" in content_type else ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(resp.content)
    tmp.close()
    return tmp.name


def _handle_text(text: str, say) -> None:
    if text.lower() in ("/start", "hi", "hello", "help", "/help"):
        say(
            "👋 Hi! Send me a photo of your receipt and I'll extract, categorize, "
            "and match it to your Wio Business transactions automatically.\n\n"
            "_Note: This demo attributes all receipts to Sara (founder). "
            "Team member registration coming soon._"
        )
