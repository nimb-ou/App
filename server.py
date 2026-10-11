from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import mimetypes
import re

ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"
PORT = 7860
MAX_SHARE_BYTES = 25 * 1024 * 1024
SHARE_PATH = re.compile(r"^/share/[A-Za-z0-9-]+/?$")


def validate_share_url(value):
    if not value or len(value) > 2048:
        raise ValueError("Provide a public ChatGPT share link.")
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "chatgpt.com"
        or parsed.port is not None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or not SHARE_PATH.fullmatch(parsed.path)
    ):
        raise ValueError("Only public https://chatgpt.com/share/... links can be loaded.")
    return "https://chatgpt.com" + parsed.path.rstrip("/")


class ChatGPTRedirectsOnly(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        parsed = urlsplit(new_url)
        if parsed.scheme != "https" or parsed.hostname != "chatgpt.com" or parsed.port is not None:
            raise HTTPError(new_url, code, "Share link redirected outside chatgpt.com", headers, response)
        return super().redirect_request(request, response, code, message, headers, new_url)


class BatonHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format_string, *args):
        # Do not write request paths; share IDs are part of the path or query.
        return

    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        request = urlsplit(self.path)
        if request.path == "/api/share":
            self.fetch_share(request.query)
            return
        self.serve_file(request.path)

    def fetch_share(self, query):
        try:
            params = parse_qs(query, strict_parsing=True)
            if set(params) != {"url"} or len(params["url"]) != 1:
                raise ValueError("Provide one public ChatGPT share link.")
            share_url = validate_share_url(params["url"][0])
            request = Request(
                share_url,
                headers={
                    "Accept": "text/html",
                    "Accept-Encoding": "identity",
                    "User-Agent": "Mozilla/5.0 (compatible; BatonShareImporter/1.0)",
                },
            )
            opener = build_opener(ChatGPTRedirectsOnly())
            with opener.open(request, timeout=25) as response:
                if urlsplit(response.geturl()).hostname != "chatgpt.com":
                    raise ValueError("The share link redirected outside chatgpt.com.")
                content_type = response.headers.get_content_type()
                if content_type != "text/html":
                    raise ValueError("ChatGPT did not return a share page. Check that the link is public.")
                declared_size = response.headers.get("Content-Length")
                if declared_size and int(declared_size) > MAX_SHARE_BYTES:
                    raise ValueError("The share page is too large to import (25 MB limit).")
                body = response.read(MAX_SHARE_BYTES + 1)
                if len(body) > MAX_SHARE_BYTES:
                    raise ValueError("The share page is too large to import (25 MB limit).")
            self.send_bytes(200, body, "text/html; charset=utf-8")
        except ValueError as error:
            self.send_bytes(400, str(error).encode("utf-8"), "text/plain; charset=utf-8")
        except HTTPError as error:
            self.send_bytes(502, ("ChatGPT could not load that share link (HTTP " + str(error.code) + ").").encode("utf-8"), "text/plain; charset=utf-8")
        except (TimeoutError, URLError, OSError):
            self.send_bytes(502, b"ChatGPT could not be reached. Please try again.", "text/plain; charset=utf-8")

    def serve_file(self, request_path):
        relative = unquote(request_path).lstrip("/") or "index.html"
        candidate = (ROOT / relative).resolve()
        if not candidate.is_relative_to(ROOT) or not candidate.is_file():
            self.send_bytes(404, b"Not found.", "text/plain; charset=utf-8")
            return
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if content_type == "text/html":
            content_type += "; charset=utf-8"
        elif content_type in {"text/css", "text/javascript", "application/javascript", "application/json"}:
            content_type += "; charset=utf-8"
        self.send_bytes(200, candidate.read_bytes(), content_type)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), BatonHandler).serve_forever()
