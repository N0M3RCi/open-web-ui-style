# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Minimal stub server for the frontend proxy API (/api/v1/* routes).
# Runs on port 3001 to satisfy the Vite dev server proxy target.
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="M3RCI - UniMind Server (stub)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Provider routes ──────────────────────────────────────────────────────────

@app.get("/v1/providers")
async def list_providers():
    """Return configured model providers (NEAR AI only by default)."""
    return {
        "code": 0,
        "items": [],
        "total": 0,
    }


@app.get("/v1/models/platforms")
async def list_platforms():
    """Return available model platforms."""
    return {"code": 0, "platforms": ["nearai"]}


@app.get("/v1/models")
async def list_models(platform: str = Query("nearai")):
    """Return available models for a given platform."""
    return {"code": 0, "models": []}


@app.get("/v1/cloud-models")
async def cloud_models(kind: str = Query("chat")):
    """Return available cloud models by kind."""
    return {"code": 0, "models": []}


@app.get("/v1/user/auto-login")
async def auto_login():
    """Auto-login stub – lets the frontend session init succeed."""
    return {"code": 0, "user_id": 1, "token": "stub-token"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "merci-server-stub"}


@app.get("/")
async def root():
    return {"service": "merci-server-stub", "health": "/health"}


if __name__ == "__main__":
    port = int(os.environ.get("MERCI_SERVER_PORT", "3001"))
    host = os.environ.get("MERCI_SERVER_HOST", "0.0.0.0")
    print(f"Starting stub server on {host}:{port}")
    uvicorn.run("server_app:app", host=host, port=port, reload=True)