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
Standalone Brain service that serves the full Brain API including workspace
binding, chat SSE streaming, and all other controllers.

The full Brain uses the same app and router registration as the production
Brain binary, so all routes (chat, workspace, model, task, etc.) are available.

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

from app import api
from app.router import register_routers

# Register all controllers (chat, workspace, health, model, task, etc.)
register_routers(api)

app = api

if __name__ == "__main__":
    port = int(os.environ.get("MERCI_BRAIN_PORT", "5001"))
    host = os.environ.get("MERCI_BRAIN_HOST", "0.0.0.0")
    print(f"Starting full Brain service on {host}:{port}")
    uvicorn.run("run_brain:app", host=host, port=port, reload=True)