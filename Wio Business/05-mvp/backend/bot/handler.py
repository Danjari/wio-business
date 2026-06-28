"""
Slack bot event handler.

Receives message events (with image attachments) via Slack Socket Mode,
downloads the file, and dispatches to the processing pipeline.

Bot identity: all receipts are attributed to Sara (founder, t1) for the demo.

File download note: Slack's private file URLs (url_private_download) redirect through
a workspace subdomain that only accepts cookie-based auth, not Bearer tokens — a known
unresolved issue in the Slack SDK (github.com/slackapi/bolt-js/issues/2585).
Workaround: temporarily make the file public via files_sharedPublicURL, download it,
then immediately revoke public access. Requires the files:write scope.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import httpx
from slack_sdk import WebClient as SlackWebClient

from db_client import SupabaseClient

logger = logging.getLogger(__name__)

_DEMO_TEAM_MEMBER_ID = "t1"
_USER_TOKEN = os.getenv("SLACK_USER_TOKEN", "")


def handle_event(event: dict, say, client, db: SupabaseClient | None) -> None:
    """
    Process a single Slack message event.
    Called by the Slack Bolt app for each incoming message event.
    """
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
    Download a Slack file via temporary public URL.

    Bearer token auth on url_private_download is broken — Slack's redirect chain
    ends at a workspace subdomain that only accepts cookie auth (known unresolved
    Slack issue). files_sharedPublicURL also rejects bot tokens ('not_allowed_token_type').
    Workaround: use a user token (xoxp-) for files_sharedPublicURL, download,
    then revoke immediately. Requires SLACK_USER_TOKEN with user-level files:read scope.
    """
    if not _USER_TOKEN:
        raise RuntimeError(
            "SLACK_USER_TOKEN not set — add user-level files:read scope in app settings, "
            "reinstall, and copy the User OAuth Token (xoxp-...) to .env"
        )
    user_client = SlackWebClient(token=_USER_TOKEN)
    try:
        result = user_client.files_sharedPublicURL(file=file_id)
        public_url = result["file"]["permalink_public"]

        resp = httpx.get(public_url, follow_redirects=True, timeout=30.0)
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "text/html" in content_type:
            raise RuntimeError(
                "Got HTML from public file URL — public file sharing may be disabled in this workspace"
            )

        suffix = ".png" if "png" in content_type else ".pdf" if "pdf" in content_type else ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(resp.content)
        tmp.close()
        return tmp.name

    finally:
        try:
            user_client.files_revokePublicURL(file=file_id)
        except Exception as exc:
            logger.warning(f"Could not revoke public URL for file {file_id}: {exc}")


def _handle_text(text: str, say) -> None:
    if text.lower() in ("/start", "hi", "hello", "help", "/help"):
        say(
            "👋 Hi! Send me a photo of your receipt and I'll extract, categorize, "
            "and match it to your Wio Business transactions automatically.\n\n"
            "_Note: This demo attributes all receipts to Sara (founder). "
            "Team member registration coming soon._"
        )
