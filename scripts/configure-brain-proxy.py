#!/usr/bin/env python3
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
Configure nginx to proxy /brain/ requests to the Brain service (localhost:5001).
Idempotent: removes any existing /brain/ location block and re-adds it.
"""
import os
import subprocess
import sys
from pathlib import Path


def find_nginx_config() -> Path | None:
    """Find the nginx config file that contains the SPA try_files directive."""
    common_paths = [
        Path("/etc/nginx/sites-enabled/default"),
        Path("/etc/nginx/conf.d/default.conf"),
        Path("/etc/nginx/nginx.conf"),
    ]
    for path in common_paths:
        if path.exists():
            try:
                if "try_files" in path.read_text() and "index.html" in path.read_text():
                    print(f"Found nginx config at {path}")
                    return path
            except (PermissionError, OSError):
                continue
    for conf in Path("/etc/nginx").rglob("*.conf"):
        try:
            if "try_files" in conf.read_text() and "index.html" in conf.read_text():
                print(f"Found nginx config at {conf}")
                return conf
        except (PermissionError, OSError):
            continue
    return None


def main() -> int:
    print("=== Configuring nginx proxy for Brain service ===")

    conf_path = find_nginx_config()
    if conf_path is None:
        conf_path = Path("/etc/nginx/sites-enabled/default")
        print(f"Falling back to {conf_path}")

    if not conf_path.exists():
        print(f"ERROR: nginx config not found at {conf_path}", file=sys.stderr)
        return 1

    print(f"Using nginx config: {conf_path}")
    conf_str = str(conf_path)

    # Remove existing /brain/ location block (idempotent)
    result = os.system(
        f"sudo sed -i '/^[[:space:]]*location \\/brain\\/ {{/,/^[[:space:]]*}}/d' {conf_str} 2>&1"
    )
    if result != 0:
        print("Warning: failed to remove existing brain location block", file=sys.stderr)

    # Insert brain location block before the first "location / {"
    brain_block = (
        r"    location /brain/ {"
        r"\n        proxy_pass http://localhost:5001/;"
        r"\n        proxy_http_version 1.1;"
        r"\n        proxy_set_header Upgrade $http_upgrade;"
        r'\n        proxy_set_header Connection "upgrade";'
        r"\n        proxy_set_header Host $host;"
        r"\n        proxy_set_header X-Real-IP $remote_addr;"
        r"\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
        r"\n        proxy_set_header X-Forwarded-Proto $scheme;"
        r"\n        proxy_cache_bypass $http_upgrade;"
        r"\n        proxy_read_timeout 86400s;"
        r"\n        proxy_send_timeout 86400s;"
        r"\n    }"
        r"\n\n"
    )
    sed_cmd = f"sudo sed -i 's|^[[:space:]]*location / {{|{brain_block}&|' {conf_str} 2>&1"
    result = os.system(sed_cmd)
    if result != 0:
        print("ERROR: failed to insert brain location block", file=sys.stderr)
        return 1

    print(f"Added brain proxy location to {conf_path}")

    # Test nginx config
    print("Testing nginx config...")
    result = subprocess.run(["sudo", "nginx", "-t"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: nginx config test failed:\n{result.stderr}", file=sys.stderr)
        return 1
    print("nginx config test passed")

    # Reload nginx
    print("Reloading nginx...")
    result = subprocess.run(["sudo", "nginx", "-s", "reload"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: nginx reload failed:\n{result.stderr}", file=sys.stderr)
        return 1

    print("nginx reloaded successfully")
    print("=== Brain proxy configuration complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())