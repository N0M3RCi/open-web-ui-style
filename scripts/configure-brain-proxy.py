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
import re
import subprocess
import sys
from pathlib import Path


def find_nginx_config() -> Path | None:
    """Find the nginx config file that contains the SPA try_files directive."""
    # Check common paths first (these are the most likely locations)
    common_paths = [
        Path("/etc/nginx/sites-enabled/default"),
        Path("/etc/nginx/conf.d/default.conf"),
        Path("/etc/nginx/nginx.conf"),
    ]
    for path in common_paths:
        if path.exists():
            try:
                text = path.read_text()
                if "try_files" in text and "index.html" in text:
                    print(f"Found nginx config at {path}")
                    return path
            except (PermissionError, OSError):
                continue

    # Fallback: search for any .conf file containing try_files + index.html
    nginx_dirs = [Path("/etc/nginx")]
    for d in nginx_dirs:
        if not d.exists():
            continue
        for conf in d.rglob("*.conf"):
            try:
                text = conf.read_text()
                if "try_files" in text and "index.html" in text:
                    print(f"Found nginx config at {conf}")
                    return conf
            except (PermissionError, OSError):
                continue
    return None


NGINX_LOCATION_BLOCK = """    location /brain/ {
        proxy_pass http://localhost:5001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

"""


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
    content = conf_path.read_text()

    # Remove existing /brain/ location block (idempotent)
    # Uses flexible whitespace matching for the closing brace
    original_len = len(content)
    content = re.sub(
        r'location\s+/brain/\s*\{.*?\n\s*\}', '', content, flags=re.DOTALL
    )
    removed_len = original_len - len(content)
    if removed_len > 0:
        print(f"Removed existing /brain/ location block ({removed_len} chars)")

    # Add brain location block before the first location / { block
    # Uses regex for flexible spacing matching
    match = re.search(r'location\s+/\s*\{', content)
    if not match:
        print("ERROR: could not find 'location / {' in nginx config", file=sys.stderr)
        print("Config content (first 500 chars):", content[:500], file=sys.stderr)
        return 1

    insert_pos = match.start()
    content = content[:insert_pos] + NGINX_LOCATION_BLOCK + content[insert_pos:]
    print(f"Added brain proxy location to {conf_path}")

    conf_path.write_text(content)

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