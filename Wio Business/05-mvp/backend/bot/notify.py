"""
Send reply messages back to the Telegram user.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_BASE = f"https://api.telegram.org/bot{_BOT_TOKEN}"


def send_message(chat_id: int | str, text: str) -> None:
    """Send a plain text message to a Telegram chat."""
    if not _BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping notify")
        return
    try:
        resp = httpx.post(
            f"{_BASE}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10.0,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.error(f"Failed to send Telegram message to {chat_id}: {exc}")
