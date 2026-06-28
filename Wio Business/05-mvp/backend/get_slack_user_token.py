#!/usr/bin/env python3
"""
One-time script to get a Slack user OAuth token (xoxp-) via PKCE flow.

Usage:
    SLACK_CLIENT_ID=xxx SLACK_CLIENT_SECRET=yyy python get_slack_user_token.py

Get Client ID and Client Secret from:
    api.slack.com/apps → WIO → Basic Information → App Credentials

Before running, add this Redirect URL in:
    api.slack.com/apps → WIO → OAuth & Permissions → Redirect URLs
    → http://localhost:9090/callback
"""

import base64
import hashlib
import http.server
import json
import os
import secrets
import threading
import urllib.parse
import urllib.request
import webbrowser

CLIENT_ID = os.environ.get("SLACK_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SLACK_CLIENT_SECRET", "")
REDIRECT_URI = "http://localhost:9090/callback"
USER_SCOPES = "files:read files:write"

_auth_code: str | None = None


def _pkce():
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _auth_code = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        msg = b"<h1>Done! You can close this tab and check your terminal.</h1>"
        self.wfile.write(msg)

    def log_message(self, *args):
        pass


def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        print("ERROR: set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET as env vars")
        print("Get them from api.slack.com/apps → WIO → Basic Information")
        return

    verifier, challenge = _pkce()
    state = secrets.token_urlsafe(16)

    auth_url = (
        "https://slack.com/oauth/v2/authorize?"
        + urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "user_scope": USER_SCOPES,
            "redirect_uri": REDIRECT_URI,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": state,
        })
    )

    server = http.server.HTTPServer(("localhost", 9090), _Handler)
    t = threading.Thread(target=server.handle_request)
    t.start()

    print("Opening browser for Slack OAuth — click Allow when prompted...")
    webbrowser.open(auth_url)
    t.join(timeout=120)
    server.server_close()

    if not _auth_code:
        print("ERROR: no auth code received (timeout or browser didn't open)")
        return

    print("Exchanging code for token...")
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": _auth_code,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": verifier,
    }).encode()

    req = urllib.request.Request("https://slack.com/api/oauth.v2.access", data=data)
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    if not result.get("ok"):
        print(f"ERROR: {result.get('error')}")
        print(json.dumps(result, indent=2))
        return

    token = result.get("authed_user", {}).get("access_token", "")
    if token:
        print(f"\n✓ Add this to your .env:\n\nSLACK_USER_TOKEN={token}\n")
    else:
        print("No user token in response:")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
