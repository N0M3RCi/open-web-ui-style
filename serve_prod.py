# Production static file server with SPA fallback and API proxy
import http.server
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

DIST_DIR = Path(__file__).parent / "dist"
PORT = int(os.environ.get("PORT", "5173"))

BRAIN_TARGET = "http://localhost:5001"
STUB_TARGET = "http://localhost:3001"


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = parsed.query

        # Proxy workspace → Brain service
        if path.startswith("/workspace/"):
            return self._proxy(BRAIN_TARGET, path, qs)

        # Proxy /api/* → stub server (strip /api prefix)
        if path.startswith("/api/"):
            return self._proxy(STUB_TARGET, path.replace("/api", "", 1), qs)

        # Proxy /chat/* → Brain service (SSE streaming, status, etc.)
        if path.startswith("/chat"):
            return self._proxy(BRAIN_TARGET, path, qs)

        # Health check proxy
        if path == "/health":
            return self._proxy(BRAIN_TARGET, path, qs)

        # Static file or SPA fallback
        file_path = DIST_DIR / path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = parsed.query
        if path.startswith("/workspace/"):
            return self._proxy(BRAIN_TARGET, path, qs, method="POST")
        if path.startswith("/chat"):
            return self._proxy(BRAIN_TARGET, path, qs, method="POST")
        if path.startswith("/api/"):
            return self._proxy(STUB_TARGET, path.replace("/api", "", 1), qs, method="POST")
        self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = parsed.query
        if path.startswith("/workspace/"):
            return self._proxy(BRAIN_TARGET, path, qs, method="DELETE")
        if path.startswith("/chat"):
            return self._proxy(BRAIN_TARGET, path, qs, method="DELETE")
        if path.startswith("/api/"):
            return self._proxy(STUB_TARGET, path.replace("/api", "", 1), qs, method="DELETE")
        self.send_error(404)

    def _proxy(self, target, path, query, method="GET"):
        url = f"{target}{path}"
        if query:
            url += f"?{query}"
        try:
            body = None
            if method in ("POST", "PUT", "PATCH"):
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length) if length > 0 else None

            req = urllib.request.Request(url, data=body, method=method)
            for key in ("Content-Type", "Authorization", "X-Session-ID", "X-Channel", "X-User-ID"):
                val = self.headers.get(key)
                if val:
                    req.add_header(key, val)

            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "content-encoding", "content-length"):
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(502, str(e))


if __name__ == "__main__":
    print(f"Serving production build on port {PORT}")
    print(f"  Brain proxy → {BRAIN_TARGET}")
    print(f"  Stub proxy   → {STUB_TARGET}")
    server = http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler)
    server.serve_forever()