"""
FastAPI application entry point.

Exposes:
  POST /webhook  — Telegram bot webhook receiver

Run locally:
    uvicorn main:app --reload --port 8000

Set the Telegram webhook (replace <TOKEN> and <YOUR_NGROK_URL>):
    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_NGROK_URL>/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from bot import handler
from convex_client import ConvexClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Wio Business Receipt Bot")

_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

# Convex client is initialised once at startup
_convex: ConvexClient | None = None


@app.on_event("startup")
async def startup() -> None:
    global _convex
    try:
        _convex = ConvexClient()
        logger.info("Convex client initialised")
    except RuntimeError as exc:
        logger.warning(f"Convex not configured: {exc} — receipt DB writes will be skipped")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "convex": _convex is not None}


@app.post("/webhook")
async def telegram_webhook(request: Request) -> JSONResponse:
    # Validate Telegram's secret token header
    if _WEBHOOK_SECRET:
        incoming_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not hmac.compare_digest(incoming_secret, _WEBHOOK_SECRET):
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    update = await request.json()
    logger.debug(f"Received update: {update.get('update_id')}")

    # Process synchronously for simplicity in demo; use BackgroundTasks for production
    try:
        handler.handle_update(update, convex=_convex)
    except Exception as exc:
        logger.exception(f"Unhandled error in handle_update: {exc}")
        # Always return 200 to Telegram — otherwise it retries indefinitely
    return JSONResponse({"ok": True})
