#!/bin/bash
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Deployment script for M3RCI - UniMind VPS
# Run this on the VPS to update the Brain service and nginx config
# ========================================================================

set -e

echo "===== M3RCI - UniMind Deployment Script ====="
echo ""

# 1. Install Python dependencies for full Brain
echo "[1/5] Installing Python dependencies..."
pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation opentelemetry-exporter-otlp-proto-http 2>&1 | tail -3

# 2. Update the Brain service file
echo "[2/5] Updating Brain service..."
cat > /opt/merci/run_brain.py << 'BRAINEOF'
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
import os
import sys
from pathlib import Path
_project_root = Path(__file__).parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
import uvicorn
from app import api
from app.router import register_routers
register_routers(api)
app = api
if __name__ == "__main__":
    port = int(os.environ.get("MERCI_BRAIN_PORT", "5001"))
    host = os.environ.get("MERCI_BRAIN_HOST", "0.0.0.0")
    print(f"Starting full Brain service on {host}:{port}")
    uvicorn.run("run_brain:app", host=host, port=port, reload=True)
BRAINEOF

# Update systemd service file
cat > /etc/systemd/system/merci-brain.service << 'SERVICEEOF'
[Unit]
Description=MERCI Brain Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/merci
ExecStart=/usr/bin/python3 /opt/merci/run_brain.py
Restart=always
RestartSec=5
Environment=MERCI_BRAIN_PORT=5001
Environment=MERCI_BRAIN_HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 3. Update nginx config
echo "[3/5] Updating nginx config..."
cat > /etc/nginx/conf.d/merci.conf << 'NGINXEOF'
upstream brain_backend {
    server 127.0.0.1:5001;
}
upstream api_backend {
    server 127.0.0.1:3001;
}
server {
    listen 80;
    server_name class.n0m3rci.cc;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name class.n0m3rci.cc;
    ssl_certificate /etc/letsencrypt/live/class.n0m3rci.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/class.n0m3rci.cc/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 100M;
    location /health {
        proxy_pass http://brain_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /chat {
        proxy_pass http://brain_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    location /workspace/ {
        proxy_pass http://brain_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# 4. Restart services
echo "[4/5] Restarting services..."
systemctl daemon-reload
systemctl restart merci-brain
systemctl restart nginx

# 5. Verify
echo "[5/5] Verifying..."
sleep 3
echo "Brain health: $(curl -s http://localhost:5001/health)"
echo "Chat endpoint: $(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:5001/chat -H 'Content-Type: application/json' -d '{"question":"test","project_id":"test","email":"test@test.com","task_id":"test","run_id":"test","api_key":"test","model_type":"test"}')"
echo "Nginx /chat: $(curl -sk -o /dev/null -w '%{http_code}' -X POST https://localhost/chat -H 'Content-Type: application/json' -d '{"test":true}')"
echo ""
echo "===== Deployment complete! ====="