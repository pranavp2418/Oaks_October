from http.server import BaseHTTPRequestHandler
from functools import partial
from pathlib import Path
import json
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from workspace import materialize, MAX_BYTES
from agent import ProviderUnavailable, choose_live


class handler(BaseHTTPRequestHandler):
    def send_json(self, value, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(json.dumps(value, allow_nan=False).encode())

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 1 <= size <= MAX_BYTES:
                raise ValueError("Request requires 1–256 KiB")
            payload = json.loads(self.rfile.read(size))
            chooser = partial(choose_live, oidc_token=self.headers.get("x-vercel-oidc-token"))
            self.send_json(materialize(payload, live_chooser=chooser))
        except ProviderUnavailable as e:
            self.send_json({"error": str(e), "recoverable": True, "saved_workspace_unchanged": True}, 503)
        except (ValueError, TypeError, KeyError, RecursionError, sqlite3.IntegrityError) as e:
            self.send_json({"error": str(e), "saved_workspace_unchanged": True}, 400)
        except Exception:
            self.send_json({"error": "Operation could not complete. Saved workspace unchanged; retry or export."}, 500)

    def do_GET(self):
        self.send_json({"service": "MorrowStock", "schema": 1, "mode": "single-user journal and read-only bounded model tools"})
