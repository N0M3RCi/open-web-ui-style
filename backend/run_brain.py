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
"""
Minimal standalone Brain service that serves workspace binding routes.

The workspace controller (workspace_controller.py) provides endpoints for
local folder-space binding (/workspace/capabilities, /workspace/current,
/workspace/scratch, /workspace/bind, etc.).  In production environments
where the full Brain cannot run, this lightweight entry point starts just
the workspace API on the configured port (default 5001).

Usage:
    python run_brain.py
    # or
    MERCI_BRAIN_PORT=5001 python run_brain.py
"""

import os
import sys
from pathlib import Path

# Ensure the backend package is on sys.path
_project_root = Path(__file__).parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controller.workspace_controller import router as workspace_router

app = FastAPI(title="M3RCI - UniMind Workspace Service")

# CORS — allow any origin (same as the full Brain __init__.py)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"],
)

# Register only the workspace router
app.include_router(workspace_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "merci-brain-workspace"}


@app.get("/")
async def root():
    return {"service": "merci-brain-workspace", "docs": "/docs", "health": "/health"}


if __name__ == "__main__":
    port = int(os.environ.get("MERCI_BRAIN_PORT", "5001"))
    host = os.environ.get("MERCI_BRAIN_HOST", "0.0.0.0")
    print(f"Starting workspace service on {host}:{port}")
    uvicorn.run("run_brain:app", host=host, port=port, reload=True)