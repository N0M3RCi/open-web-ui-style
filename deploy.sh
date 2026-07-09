#!/bin/bash
# Deploy frontend and workspace service to production server
set -e

REMOTE_HOST="95.216.203.31"
REMOTE_USER="root"
PASSWORD="RexvRULTdNgk"
SSHPASS_CMD="/usr/bin/sshpass -p '${PASSWORD}'"

# Build frontend
echo "=== Building frontend ==="
npm run clean-cache && npx vite build

# Copy frontend
echo "=== Deploying frontend ==="
${SSHPASS_CMD} scp -o StrictHostKeyChecking=no -r dist/* ${REMOTE_USER}@${REMOTE_HOST}:/var/www/html/

# Copy workspace service backend
echo "=== Deploying workspace service ==="
# Create directory on remote server
${SSHPASS_CMD} ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} 'mkdir -p /opt/merci-brain'

# Copy backend files
${SSHPASS_CMD} scp -o StrictHostKeyChecking=no -r backend/run_brain.py backend/app backend/pyproject.toml ${REMOTE_USER}@${REMOTE_HOST}:/opt/merci-brain/

# Install deps and set up service on remote server
echo "=== Setting up workspace service ==="
${SSHPASS_CMD} ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} '
set -e

cd /opt/merci-brain

# Install pip dependencies
pip install fastapi uvicorn python-dotenv pydantic aiofiles httpx pydash inflection camel-ai opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http qdrant-client 2>&1 | tail -3

# Create systemd service file
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
Environment="MERCI_BRAIN_HOST=0.0.0.0"

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and restart service
systemctl daemon-reload
systemctl enable merci-brain
systemctl restart merci-brain

# Check if nginx workspace config exists, add proxy config
if ! grep -q "location /workspace/" /etc/nginx/sites-enabled/default 2>/dev/null; then
    # Insert workspace proxy config before the closing server block
    sed -i "/server {/a\    # Workspace API proxy (Brain service)\n    location /workspace/ {\n        proxy_pass http://127.0.0.1:5001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_cache_bypass \$http_upgrade;\n    }\n" /etc/nginx/sites-enabled/default
fi

nginx -t && systemctl reload nginx
'

echo "=== Deployment complete ==="