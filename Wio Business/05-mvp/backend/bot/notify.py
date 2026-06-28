"""
Send reply messages back to the Slack user/channel.
"""

from __future__ import annotations

import logging
import os

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

logger = logging.getLogger(__name__)

_client = WebClient(token=os.getenv("SLACK_BOT_TOKEN", ""))


def send_message(channel: str, text: str) -> None:
    """Post a plain text message to a Slack channel or DM."""
    if not os.getenv("SLACK_BOT_TOKEN"):
        logger.warning("SLACK_BOT_TOKEN not set — skipping notify")
        return
    try:
        _client.chat_postMessage(channel=channel, text=text)
    except SlackApiError as exc:
        logger.error(f"Failed to send Slack message to {channel}: {exc}")
