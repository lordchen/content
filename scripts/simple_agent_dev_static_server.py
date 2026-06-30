#!/usr/bin/env python3

from __future__ import annotations

import argparse
import gzip
import mimetypes
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


TEXT_EXTENSIONS = {
    ".css",
    ".js",
    ".html",
    ".json",
    ".map",
    ".svg",
    ".txt",
    ".xml",
}
LONG_CACHE_EXTENSIONS = {
    ".css",
    ".js",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".xlsx",
    ".xls",
    ".csv",
    ".mp4",
    ".webm",
}


class DevStaticHandler(SimpleHTTPRequestHandler):
    server_version = "SimpleAgentDevStatic/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8782")
        self.send_header("Vary", "Accept-Encoding")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        if getattr(self.server, "quiet", False):
            return
        super().log_message(format, *args)

    def do_GET(self) -> None:
        self.serve_static(head_only=False)

    def do_HEAD(self) -> None:
        self.serve_static(head_only=True)

    def serve_static(self, head_only: bool) -> None:
        path = self.resolve_path()
        if not path:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        if path.is_dir():
            index = path / "index.html"
            if index.exists():
                path = index
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Directory index disabled")
                return
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        body = path.read_bytes()
        ext = path.suffix.lower()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        should_gzip = self.should_gzip(ext, len(body))
        if should_gzip:
            body = gzip.compress(body, compresslevel=6)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        self.send_header("Cache-Control", self.cache_control(ext))
        if should_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def resolve_path(self) -> Path | None:
        raw_path = unquote(urlparse(self.path).path)
        if raw_path in {"", "/"}:
            raw_path = "/materials.html"
        relative = raw_path.lstrip("/")
        root = Path(getattr(self.server, "root_dir")).resolve()
        candidate = (root / relative).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            return None
        return candidate

    def should_gzip(self, ext: str, size: int) -> bool:
        if size < 1024 or ext not in TEXT_EXTENSIONS:
            return False
        encoding = self.headers.get("Accept-Encoding", "")
        return "gzip" in encoding.lower()

    @staticmethod
    def cache_control(ext: str) -> str:
        if ext == ".html":
            return "no-cache, max-age=0"
        if ext in LONG_CACHE_EXTENSIONS:
            return "public, max-age=3600"
        return "no-cache, max-age=0"


def main() -> None:
    parser = argparse.ArgumentParser(description="Simple Agent development static server with gzip and cache headers.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8782)
    parser.add_argument("--root", default=os.getcwd())
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    server = ThreadingHTTPServer((args.host, args.port), DevStaticHandler)
    server.root_dir = str(root)
    server.quiet = args.quiet
    print(f"Serving {root} on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
