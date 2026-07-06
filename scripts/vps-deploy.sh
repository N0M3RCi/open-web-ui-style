#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/open-web-ui-style"
DEPLOY_LOG="/var/log/open-web-ui-deploy.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deploy check..." >> "$DEPLOY_LOG"

cd "$APP_DIR"

# Fetch latest without merging
GIT_SSH_COMMAND='ssh -i /root/.ssh/github-deploy -o StrictHostKeyChecking=no' git fetch origin main 2>> "$DEPLOY_LOG"

# Check if we're behind origin/main
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Already up to date ($LOCAL_HASH). Nothing to do." >> "$DEPLOY_LOG"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] New commit found: $REMOTE_HASH (was: $LOCAL_HASH)" >> "$DEPLOY_LOG"

# Pull latest
GIT_SSH_COMMAND='ssh -i /root/.ssh/github-deploy -o StrictHostKeyChecking=no' git pull --ff-only origin main 2>> "$DEPLOY_LOG"

# Install deps
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing dependencies..." >> "$DEPLOY_LOG"
npm install --ignore-scripts --no-audit --no-fund 2>> "$DEPLOY_LOG"

# Build web app
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building web app..." >> "$DEPLOY_LOG"
npm run build:web 2>> "$DEPLOY_LOG"

# Copy to nginx web root
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Copying to /var/www/html..." >> "$DEPLOY_LOG"
rm -rf /var/www/html/*
cp -r dist-web/* /var/www/html/

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy complete!" >> "$DEPLOY_LOG"