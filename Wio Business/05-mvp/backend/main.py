"""
Wio Business Receipt Bot — Slack Socket Mode entry point.

Run locally (no ngrok or public URL needed):
    python main.py

Slack app setup:
  1. api.slack.com/apps → Create app → From scratch
  2. Settings → Socket Mode → Enable → generate App-Level Token (connections:write scope)
     → set as SLACK_APP_TOKEN (xapp-...)
  3. OAuth & Permissions → Bot Token Scopes:
       chat:write, files:read, im:history, channels:history, groups:history
  4. Event Subscriptions → Subscribe to bot events:
       message.im, message.channels, message.groups
  5. Install to workspace → copy Bot User OAuth Token → SLACK_BOT_TOKEN (xoxb-...)
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from bot import handler
from db_client import SupabaseClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = App(token=os.getenv("SLACK_BOT_TOKEN", ""))

_db: SupabaseClient | None = None
try:
    _db = SupabaseClient()
    logger.info("Supabase client initialised")
except RuntimeError as exc:
    logger.warning(f"Supabase not configured: {exc} — DB writes will be skipped")


@app.event("message")
def handle_message(event, say):
    handler.handle_event(event, say=say, db=_db)


if __name__ == "__main__":
    app_token = os.getenv("SLACK_APP_TOKEN", "")
    if not app_token:
        raise RuntimeError("SLACK_APP_TOKEN must be set in .env")
    logger.info("Starting Slack Socket Mode — no public URL needed")
    SocketModeHandler(app, app_token).start()
