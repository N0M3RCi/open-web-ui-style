#!/bin/bash
# Deploy frontend and workspace service.
# Do not put passwords in this file. Pass the server and an SSH key from the environment:
#   DEPLOY_HOST=your.server DEPLOY_SSH_KEY=/path/to/key ./deploy.sh
set -euo pipefail

REMOTE_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the server address}"
REMOTE_USER="${DEPLOY_USER:-root}"
SSH_KEY="${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY to the path of a private key file}"

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=yes)
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=yes)

echo "=== Building frontend ==="
npm run clean-cache && npx vite build

echo "=== Deploying frontend ==="
"${SSH[@]}" "${REMOTE_USER}@${REMOTE_HOST}" 'mkdir -p /var/www/html'
"${SCP[@]}" -r dist/* "${REMOTE_USER}@${REMOTE_HOST}:/var/www/html/"

echo "=== Deploying workspace service ==="
"${SSH[@]}" "${REMOTE_USER}@${REMOTE_HOST}" 'mkdir -p /opt/merci-brain'
"${SCP[@]}" -r backend/run_brain.py backend/app backend/pyproject.toml "${REMOTE_USER}@${REMOTE_HOST}:/opt/merci-brain/"

echo "=== Setting up workspace service ==="
"${SSH[@]}" "${REMOTE_USER}@${REMOTE_HOST}" 'bash -s' << 'REMOTE'
set -e
cd /opt/merci-brain
pip install fastapi uvicorn python-dotenv pydantic aiofiles httpx pydash inflection camel-ai opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http qdrant-client 2>&1 | tail -3
cat > /etc/systemd/system/merci-brain.service << "SERVICEEOF"
[Unit]
Description=M3RCI Workspace Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/merci-brain
ExecStart=/usr/bin/python3 /opt/merci-brain/run_brain.py
Restart=always
RestartSec=5
Environment="MERCI_BRAIN_PORT=5001"
Environment="MERCI_BRAIN_HOST=127.0.0.1"

[Install]
WantedBy=multi-user.target
SERVICEEOF
systemctl daemon-reload
systemctl enable merci-brain
systemctl restart merci-brain
nginx -t && systemctl reload nginx
REMOTE
