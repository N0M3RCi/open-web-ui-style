#!/usr/bin/env python3
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

"""Zero-dependency GitHub webhook listener for auto-deploy."""

import http.server
import hmac
import hashlib
import json
import os
import subprocess
import sys
import threading

SECRET = os.environ.get('GITHUB_WEBHOOK_SECRET', '').encode()
APP_DIR = os.environ.get('APP_DIR', '/opt/open-web-ui-style')
BRANCH = os.environ.get('BRANCH', 'main')
PORT = int(os.environ.get('WEBHOOK_PORT', '9000'))


class WebhookHandler(http.server.BaseHTTPRequestHandler):
    """Handle GET /health and POST /webhook for GitHub push events."""

    def do_POST(self):
        if self.path != '/webhook':
            self.send_error(404)
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        signature = self.headers.get('X-Hub-Signature-256', '')
        if SECRET:
            expected = 'sha256=' + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                self.send_error(401, 'Invalid signature')
                return

        event = self.headers.get('X-GitHub-Event', '')
        if event != 'push':
            self.send_response(200)
            self.end_headers()
            self.wfile.write('Ignored event: {}'.format(event).encode())
            return

        try:
            data = json.loads(body)
            ref = data.get('ref', '')
            if not ref.endswith('/{}'.format(BRANCH)):
                self.send_response(200)
                self.end_headers()
                self.wfile.write('Ignored push to {}'.format(ref).encode())
                return
        except json.JSONDecodeError:
            self.send_error(400, 'Invalid JSON')
            return

        threading.Thread(target=run_deploy, daemon=True).start()

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'Deploy started')

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
            return
        self.send_error(404)

    def log_message(self, format, *args):
        sys.stderr.write('[webhook] {}\n'.format(format % args))


def run_deploy():
    """Run the deploy script in background."""
    try:
        result = subprocess.run(
            ['bash', '/opt/open-web-ui-style/deploy.sh'],
            capture_output=True, text=True, timeout=300,
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
    except Exception as e:
        print('Deploy error: {}'.format(e), file=sys.stderr)


if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), WebhookHandler)
    print('Webhook server listening on 127.0.0.1:{}'.format(PORT))
    server.serve_forever()