#!/usr/bin/env python3
"""Deprecated: use Vercel serverless API + Neon Postgres (web/api/progress/).

Local file-based fallback only if you cannot run `vercel dev`.
"""

from __future__ import annotations

import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8787
DATA_DIR = Path(__file__).resolve().parent / "data"
DEVICE_RE = re.compile(r"^[a-f0-9-]{16,64}$", re.I)


class ProgressHandler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, payload: dict | list) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        device_id = self._device_id()
        if not device_id:
            self._send_json(404, {"error": "not found"})
            return
        path = DATA_DIR / f"{device_id}.json"
        if not path.exists():
            self._send_json(404, {"error": "no progress"})
            return
        data = json.loads(path.read_text(encoding="utf-8"))
        self._send_json(200, data)

    def do_PUT(self) -> None:
        device_id = self._device_id()
        if not device_id:
            self._send_json(400, {"error": "invalid device id"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "invalid json"})
            return
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        (DATA_DIR / f"{device_id}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._send_json(200, {"ok": True})

    def _device_id(self) -> str | None:
        parts = self.path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != "progress":
            return None
        device_id = parts[1]
        if not DEVICE_RE.match(device_id):
            return None
        return device_id

    def log_message(self, format: str, *args) -> None:
        print(f"[progress-api] {self.address_string()} {format % args}")


def main() -> None:
    server = HTTPServer((HOST, PORT), ProgressHandler)
    print(f"Progress API on http://{HOST}:{PORT}")
    print("Set VITE_PROGRESS_API_URL=http://localhost:8787 in web/.env.local")
    server.serve_forever()


if __name__ == "__main__":
    main()
