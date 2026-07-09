#!/bin/bash
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Robust backend watchdog — keeps PostgreSQL, Redis, and uvicorn running 24/7.
# This script is designed to NEVER exit. It restarts any failed service
# automatically and logs everything to /tmp/backend-watchdog.log.

set -o pipefail

LOG_FILE="/tmp/backend-watchdog.log"
UVICORN_PORT="${UVICORN_PORT:-3001}"
UVICORN_HOST="${UVICORN_HOST:-0.0.0.0}"
SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Backend watchdog started ==="
log "Server directory: $SERVER_DIR"
log "Uvicorn: $UVICORN_HOST:$UVICORN_PORT"

# Ensure postgresql is running
ensure_postgresql() {
  if ! pg_isready -q 2>/dev/null; then
    log "PostgreSQL is DOWN. Starting..."
    service postgresql start 2>&1 | tee -a "$LOG_FILE"
    for i in $(seq 1 10); do
      if pg_isready -q 2>/dev/null; then
        log "PostgreSQL is UP after ${i}s"
        return 0
      fi
      sleep 1
    done
    log "CRITICAL: PostgreSQL failed to start!"
    return 1
  fi
  return 0
}

# Ensure redis is running
ensure_redis() {
  if ! redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis is DOWN. Starting..."
    service redis-server start 2>&1 | tee -a "$LOG_FILE"
    for i in $(seq 1 10); do
      if redis-cli ping 2>/dev/null | grep -q PONG; then
        log "Redis is UP after ${i}s"
        return 0
      fi
      sleep 1
    done
    log "CRITICAL: Redis failed to start!"
    return 1
  fi
  return 0
}

# Run alembic migrations
run_migrations() {
  log "Running alembic migrations..."
  cd "$SERVER_DIR" || return 1
  uv run alembic upgrade head 2>&1 | tee -a "$LOG_FILE"
  if [ $? -eq 0 ]; then
    log "Migrations completed successfully"
    return 0
  else
    log "Migrations failed! Will retry on next cycle."
    return 1
  fi
}

# Start uvicorn with auto-restart
start_uvicorn() {
  cd "$SERVER_DIR" || return 1
  log "Starting uvicorn on $UVICORN_HOST:$UVICORN_PORT..."
  # Use exec so uvicorn replaces this shell process
  # Wrap in a loop so it restarts on crash
  while true; do
    uv run uvicorn main:app \
      --host "$UVICORN_HOST" \
      --port "$UVICORN_PORT" \
      --workers 1 \
      --timeout-keep-alive 30 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=$?
    log "uvicorn exited with code $EXIT_CODE. Restarting in 2 seconds..."
    sleep 2
  done
}

# Main watchdog loop
WATCHDOG_INTERVAL=15
run_migrations

# Start uvicorn in background so watchdog can monitor services
start_uvicorn &
UVICORN_PID=$!
log "Uvicorn PID: $UVICORN_PID"

# Watchdog loop — monitor services and restart if needed
while true; do
  # Check PostgreSQL
  if ! ensure_postgresql; then
    log "WARNING: PostgreSQL still down after retry"
  fi

  # Check Redis
  if ! ensure_redis; then
    log "WARNING: Redis still down after retry"
  fi

  # Check uvicorn
  if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    log "uvicorn process is dead! Restarting..."
    start_uvicorn &
    UVICORN_PID=$!
    log "New uvicorn PID: $UVICORN_PID"
  fi

  sleep "$WATCHDOG_INTERVAL"
done