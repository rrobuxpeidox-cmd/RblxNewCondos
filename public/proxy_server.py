"""
Static file server with built-in CORS proxy for Roblox API.
Serves static files from current directory AND proxies API requests
to Roblox endpoints via /api/proxy?url=...
Uses requests library for better error handling and retry.
"""
import http.server
import json
import socketserver
import urllib.parse
import os
import time
import requests

PORT = 8080
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

ROBLOX_DOMAINS = [
    "users.roblox.com",
    "thumbnails.roblox.com",
    "accountinformation.roblox.com",
]

# Session with retry logic
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/proxy?'):
            self.handle_proxy()
        elif self.path == '/api/proxy':
            self.handle_proxy()
        else:
            super().do_GET()

    def handle_proxy(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
        target = params.get('url', [''])[0]

        if not target:
            self._send_json(400, {"error": "Missing 'url' parameter"})
            return

        # Validate target is a Roblox API
        parsed_target = urllib.parse.urlparse(target)
        if parsed_target.hostname not in ROBLOX_DOMAINS:
            self._send_json(403, {"error": "Only Roblox API endpoints allowed"})
            return

        # Retry logic for 429 rate limiting
        max_retries = 3
        for attempt in range(max_retries):
            try:
                resp = session.get(target, timeout=8)
                if resp.status_code == 200:
                    self.send_response(200)
                    self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Length', str(len(resp.content)))
                    self.end_headers()
                    self.wfile.write(resp.content)
                    return
                elif resp.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = 3 * (attempt + 1)
                        time.sleep(wait_time)
                        continue
                    else:
                        self._send_json(429, {"error": "Roblox API rate limit exceeded. Please try again later."})
                        return
                else:
                    self._send_json(resp.status_code, {"error": f"HTTP {resp.status_code}"})
                    return
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                self._send_json(504, {"error": "Request timeout"})
                return
            except requests.exceptions.ConnectionError as e:
                self._send_json(502, {"error": f"Connection error: {str(e)[:100]}"})
                return
            except Exception as e:
                self._send_json(502, {"error": str(e)[:100]})
                return

    def _send_json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Silence logs

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    with ReusableTCPServer(("", PORT), ProxyHandler) as httpd:
        print(f"Serving on port {PORT} with /api/proxy endpoint")
        httpd.serve_forever()
