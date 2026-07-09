# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Stub server for the frontend proxy API (/api/v1/* and /v1/* routes).
# Runs on port 3001 to satisfy both Vite dev proxy and production builds.
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

import os

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


def ok(data=None):
    """Standard success response."""
    return data if data is not None else {"code": 0}


def paged(items, total=None):
    return {"code": 0, "items": items, "total": total if total is not None else len(items)}


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.get("/v1/user/auto-login")
@app.get("/api/v1/user/auto-login")
async def auto_login():
    return {"code": 0, "user_id": 1, "token": "stub-token"}


@app.get("/v1/user/stat")
@app.get("/api/v1/user/stat")
async def user_stat():
    return ok({"model_type": "unused", "memory_quota": 0, "memory_used": 0})


# ── Providers / Models ──────────────────────────────────────────────────────

@app.get("/v1/providers")
@app.get("/api/v1/providers")
async def list_providers(keyword: str | None = None, prefer: bool | None = None):
    return paged([])


@app.get("/v1/models/platforms")
@app.get("/api/v1/models/platforms")
async def list_platforms():
    return {"code": 0, "platforms": ["nearai"]}


@app.get("/v1/models")
@app.get("/api/v1/models")
async def list_models(platform: str = Query("nearai")):
    return {"code": 0, "models": []}


@app.get("/v1/cloud-models")
@app.get("/api/v1/cloud-models")
async def cloud_models(kind: str = Query("chat")):
    return {"code": 0, "models": []}


# ── Chat ─────────────────────────────────────────────────────────────────────

@app.get("/v1/chat/histories")
@app.get("/api/v1/chat/histories")
async def chat_histories(page: int = 1, page_size: int = 20, include_tasks: bool = False):
    return paged([])


@app.get("/v1/chat/histories/grouped")
@app.get("/api/v1/chat/histories/grouped")
async def chat_histories_grouped(page: int = 1, page_size: int = 20, include_tasks: bool = False):
    return paged([])


@app.get("/v1/chat/history/{history_id}")
@app.get("/api/v1/chat/history/{history_id}")
async def chat_history(history_id: str):
    return ok(None)


@app.get("/v1/chat/share/{share_id}")
@app.get("/api/v1/chat/share/{share_id}")
async def chat_share(share_id: str):
    return ok(None)


@app.get("/v1/chat/share/playback/{playback_id}")
@app.get("/api/v1/chat/share/playback/{playback_id}")
async def chat_share_playback(playback_id: str, delay_time: int = 0):
    return ok(None)


@app.get("/v1/chat/snapshots")
@app.get("/api/v1/chat/snapshots")
async def chat_snapshots():
    return paged([])


@app.get("/v1/chat/steps/playback/{step_id}")
@app.get("/api/v1/chat/steps/playback/{step_id}")
async def chat_steps_playback(step_id: str, delay_time: int = 0):
    return ok(None)


# ── Config ───────────────────────────────────────────────────────────────────

@app.get("/v1/configs")
@app.get("/api/v1/configs")
async def list_configs():
    return paged([])


# ── Spaces ───────────────────────────────────────────────────────────────────

@app.get("/v1/spaces")
@app.get("/api/v1/spaces")
async def list_spaces():
    return paged([])


@app.get("/v1/spaces/legacy")
@app.get("/api/v1/spaces/legacy")
async def legacy_spaces():
    return paged([])


# ── Execution / Triggers ─────────────────────────────────────────────────────

@app.get("/v1/execution/subscribe")
@app.get("/api/v1/execution/subscribe")
async def execution_subscribe():
    return ok({"items": [], "total": 0})


@app.get("/v1/trigger/")
@app.get("/api/v1/trigger/")
async def list_triggers():
    return paged([])


@app.get("/v1/trigger/{trigger_id}")
@app.get("/api/v1/trigger/{trigger_id}")
async def get_trigger(trigger_id: str):
    return ok(None)


# ── Remote Control ───────────────────────────────────────────────────────────

@app.get("/v1/remote-control/sessions")
@app.get("/api/v1/remote-control/sessions")
async def remote_control_sessions():
    return paged([])


@app.get("/v1/remote-control/bridge/subscribe")
@app.get("/api/v1/remote-control/bridge/subscribe")
async def remote_control_bridge_subscribe():
    return ok({"items": [], "total": 0})


# ── Remote Sub Agent ─────────────────────────────────────────────────────────

@app.get("/v1/remote-sub-agent-providers")
@app.get("/api/v1/remote-sub-agent-providers")
async def remote_sub_agent_providers():
    return paged([])


# ── Webhook ──────────────────────────────────────────────────────────────────

@app.post("/api/webhook/{channel}")
async def webhook(channel: str):
    return ok()


# ── Health / Root ────────────────────────────────────────────────────────────

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