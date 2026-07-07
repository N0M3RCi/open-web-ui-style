#!/usr/bin/env bash
# =============================================================================
# Deploy script for fastvps.hosting
# Run this on the VPS to pull latest code, build, and restart the app.
#
# Usage:
#   ssh root@fastvps.hosting 'bash -s' < scripts/deploy-vps.sh
#
# Or on the VPS directly:
#   cd /opt/open-web-ui-style && bash scripts/deploy-vps.sh
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/open-web-ui-style}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-open-web-ui-style}"

echo "=== M3RCI - UniMind Deploy ==="
echo "Target:   $APP_DIR"
echo "Branch:   $BRANCH"

# Step 1: Pull latest code
if [ -d "$APP_DIR" ]; then
  echo "[1/5] Pulling latest code..."
  cd "$APP_DIR"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  echo "[1/5] Cloning repository..."
  git clone https://github.com/N0M3RCi/open-web-ui-style.git "$APP_DIR"
  cd "$APP_DIR"
  git checkout "$BRANCH"
fi

# Step 2: Install frontend dependencies
echo "[2/5] Installing frontend dependencies..."
npm ci --ignore-scripts

# Step 3: Build web app
echo "[3/5] Building web app..."
npm run build:web

# Step 4: Copy build to web root (if using nginx)
if [ -d "/var/www/html" ]; then
  echo "[4/5] Copying build to web root..."
  rm -rf /var/www/html/*
  cp -r dist-web/* /var/www/html/
fi

# Step 5: Restart the app server
echo "[5/5] Restarting service..."
if command -v systemctl &> /dev/null && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl restart "$SERVICE_NAME"
  echo "  Restarted systemd service: $SERVICE_NAME"
elif command -v pm2 &> /dev/null && pm2 list | grep -q "$SERVICE_NAME"; then
  pm2 restart "$SERVICE_NAME"
  echo "  Restarted pm2 process: $SERVICE_NAME"
else
  echo "  No service manager found for $SERVICE_NAME — skipping restart."
  echo "  If using a simple server, restart it manually."
fi

echo "=== Deploy complete ==="
