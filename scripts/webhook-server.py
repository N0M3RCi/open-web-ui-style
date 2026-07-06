#!/usr/bin/env python3
"""
GitHub webhook listener for auto-deploy.

Run this on the VPS to listen for GitHub push events:

  python3 scripts/webhook-server.py &

When GitHub sends a push event, this server pulls the latest code,
rebuilds the web app, and restarts the server.

Requires: pip install flask hmac hashlib
"""

import hmac
import hashlib
import os
import subprocess
import sys
from flask import Flask, request, abort

app = Flask(__name__)

# Generate a random secret and set it in GitHub repo Settings > Webhooks > Add webhook
# Then set it as an environment variable on the VPS:
#   export GITHUB_WEBHOOK_SECRET="your-secret-here"
SECRET = os.environ.get('GITHUB_WEBHOOK_SECRET', 'change-me')
APP_DIR = os.environ.get('APP_DIR', '/opt/open-web-ui-style')
BRANCH = os.environ.get('BRANCH', 'main')

@app.route('/webhook', methods=['POST'])
def webhook():
    # Verify signature
    signature = request.headers.get('X-Hub-Signature-256', '')
    payload = request.get_data()
    expected = 'sha256=' + hmac.new(
        SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        abort(401, 'Invalid signature')

    # Verify it's a push to our branch
    event = request.headers.get('X-GitHub-Event', '')
    if event != 'push':
        return f'Ignored event: {event}', 200

    data = request.get_json()
    ref = data.get('ref', '')
    if not ref.endswith(f'/{BRANCH}'):
        return f'Ignored push to {ref}', 200

    # Run deploy
    try:
        result = subprocess.run(
            ['bash', f'{APP_DIR}/scripts/deploy-vps.sh'],
            capture_output=True, text=True, timeout=300,
            env={**os.environ, 'APP_DIR': APP_DIR, 'BRANCH': BRANCH}
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            return f'Deploy failed (exit {result.returncode})', 500
        return 'Deploy OK', 200
    except Exception as e:
        print(f'Deploy error: {e}', file=sys.stderr)
        return str(e), 500

if __name__ == '__main__':
    port = int(os.environ.get('WEBHOOK_PORT', 9000))
    print(f'Starting webhook server on port {port}...')
    app.run(host='0.0.0.0', port=port)