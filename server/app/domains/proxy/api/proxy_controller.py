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

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import session
from app.model.config.config import Config
from app.shared.auth import auth_must
from app.shared.auth.user_auth import V1UserAuth

router = APIRouter(tags=["Proxy Management"])


class ProxyTestIn(BaseModel):
    proxy_url: str


class ProxyTestOut(BaseModel):
    is_valid: bool
    message: str = ""
    latency_ms: float | None = None


class ProxyConfigOut(BaseModel):
    proxy_url: str = ""


@router.post("/proxy/test", name="test proxy connectivity")
async def test_proxy(data: ProxyTestIn, auth: V1UserAuth = Depends(auth_must)) -> ProxyTestOut:
    """Test proxy connectivity by making a request through the proxy."""
    proxy_url = data.proxy_url.strip()
    if not proxy_url:
        return ProxyTestOut(is_valid=False, message="Proxy URL is required")

    # Validate URL format
    try:
        parsed = __import__("urllib.parse").urlparse(proxy_url)
        if parsed.scheme not in ("http", "https", "socks5", "socks4"):
            return ProxyTestOut(
                is_valid=False,
                message=f"Unsupported scheme '{parsed.scheme}'. Use http, https, socks5, or socks4.",
            )
    except Exception as e:
        return ProxyTestOut(is_valid=False, message=f"Invalid URL: {e}")

    import time

    start = time.time()
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=10) as client:
            resp = await client.get("https://www.google.com/generate_204")
            elapsed = round((time.time() - start) * 1000, 1)
            if resp.status_code == 204:
                return ProxyTestOut(is_valid=True, message="Proxy is working", latency_ms=elapsed)
            else:
                return ProxyTestOut(
                    is_valid=True,
                    message=f"Proxy responded with status {resp.status_code}",
                    latency_ms=elapsed,
                )
    except httpx.ProxyError as e:
        return ProxyTestOut(is_valid=False, message=f"Proxy connection failed: {e}")
    except httpx.ConnectError as e:
        return ProxyTestOut(is_valid=False, message=f"Cannot connect to proxy: {e}")
    except httpx.TimeoutException:
        return ProxyTestOut(is_valid=False, message="Proxy timed out after 10 seconds")
    except Exception as e:
        return ProxyTestOut(is_valid=False, message=f"Proxy test failed: {e}")


@router.post("/proxy/config", name="save proxy config")
async def save_proxy_config(
    data: ProxyTestIn,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Save proxy URL to user config."""
    proxy_url = data.proxy_url.strip()

    stmt = select(Config).where(Config.user_id == auth.id, Config.config_name == "proxy_url")
    existing = db_session.exec(stmt).first()
    if existing:
        existing.config_value = proxy_url
        db_session.add(existing)
    else:
        config = Config(
            user_id=auth.id,
            config_name="proxy_url",
            config_value=proxy_url,
            config_group="PROXY",
        )
        db_session.add(config)
    db_session.commit()
    return {"success": True, "proxy_url": proxy_url}


@router.get("/proxy/config", name="get proxy config", response_model=ProxyConfigOut)
async def get_proxy_config(
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Get saved proxy URL from user config."""
    stmt = select(Config).where(Config.user_id == auth.id, Config.config_name == "proxy_url")
    existing = db_session.exec(stmt).first()
    if existing and existing.config_value:
        return ProxyConfigOut(proxy_url=existing.config_value)
    return ProxyConfigOut(proxy_url="")
