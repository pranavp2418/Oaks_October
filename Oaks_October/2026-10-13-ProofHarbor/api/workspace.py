from http.server import BaseHTTPRequestHandler
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core import materialize, MAX_BYTES


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 1 <= size <= MAX_BYTES:
                raise ValueError("Request must contain 1–128 KiB.")
            payload = json.loads(self.rfile.read(size))
            result = materialize(payload)
            status = 200
        except (ValueError, TypeError, KeyError, RecursionError) as error:
            result, status = {"error": str(error)}, 400
        except Exception:
            result, status = {"error": "Investigation could not complete. The saved browser journal is unchanged; retry or export it."}, 500
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"service":"ProofHarbor","mode":"bounded deterministic evidence retrieval","schema":1}')
