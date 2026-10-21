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

# STATUS: full-rewrite (uses ProviderService, self-managed session)

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi_babel import _
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlmodel import paginate
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.core.database import session
from app.domains.model_provider.service.provider_service import ProviderService
from app.model.provider.provider import Provider, ProviderIn, ProviderOut, ProviderPreferIn
from app.shared.auth import auth_must
from app.shared.auth.user_auth import V1UserAuth

router = APIRouter(tags=["Provider Management"])


@router.get("/providers", name="list providers", response_model=Page[ProviderOut])
async def gets(
    keyword: str | None = None,
    prefer: bool | None = Query(None, description="Filter by prefer status"),
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
) -> Page[ProviderOut]:
    # Pagination still needs session for paginate() — use session directly for this read-only query
    stmt = select(Provider).where(Provider.user_id == auth.id, Provider.no_delete())
    if keyword:
        stmt = stmt.where(col(Provider.provider_name).like(f"%{keyword}%"))
    if prefer is not None:
        stmt = stmt.where(Provider.prefer == prefer)
    stmt = stmt.order_by(col(Provider.created_at).desc(), col(Provider.id).desc())
    return paginate(db_session, stmt)


@router.get("/provider", name="get provider detail", response_model=ProviderOut)
async def get(id: int, auth: V1UserAuth = Depends(auth_must)):
    model = ProviderService.get(id, auth.id)
    if not model:
        raise HTTPException(status_code=404, detail=_("Provider not found"))
    return model


@router.post("/provider", name="create provider", response_model=ProviderOut)
async def post(data: ProviderIn, auth: V1UserAuth = Depends(auth_must)):
    result = ProviderService.create(auth.id, data.model_dump())
    return result["provider"]


@router.put("/provider/{id}", name="update provider", response_model=ProviderOut)
async def put(id: int, data: ProviderIn, auth: V1UserAuth = Depends(auth_must)):
    result = ProviderService.update(id, auth.id, data.model_dump())
    if not result["success"]:
        raise HTTPException(status_code=404, detail=_("Provider not found"))
    return result["provider"]


@router.delete("/provider/{id}", name="delete provider")
async def delete(id: int, auth: V1UserAuth = Depends(auth_must)):
    if not ProviderService.delete(id, auth.id):
        raise HTTPException(status_code=404, detail=_("Provider not found"))
    return Response(status_code=204)


@router.patch("/provider/{id}/invalidate", name="invalidate provider")
async def invalidate(id: int, auth: V1UserAuth = Depends(auth_must)):
    result = ProviderService.invalidate(id, auth.id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=_("Provider not found"))
    return {"success": True}


class FetchModelsIn(BaseModel):
    url: str
    api_key: str


def _assert_public_http_url(url: str) -> None:
    """Reject loopback, private, and link-local addresses so this proxy cannot scan the server."""
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Model URL must be an http(s) address")
    host = parsed.hostname.strip("[]")
    try:
        addresses = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve model URL")
    for info in addresses:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise HTTPException(status_code=400, detail="That model URL is not allowed")


async def _fetch_provider_models(url: str, api_key: str):
    import httpx

    _assert_public_http_url(url)
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
        resp = await client.get(url, headers=headers)
    if not resp.is_success:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Upstream returned {resp.status_code}",
        )
    return resp.json()


@router.post("/providers/models/fetch", name="fetch models from provider API")
async def fetch_models(data: FetchModelsIn, auth: V1UserAuth = Depends(auth_must)):
    """Proxy a model list request. The API key stays in the request body, not the URL."""
    return await _fetch_provider_models(data.url, data.api_key)


@router.post("/provider/prefer", name="set provider prefer")
async def set_prefer(data: ProviderPreferIn, auth: V1UserAuth = Depends(auth_must)):
    result = ProviderService.set_prefer(data.provider_id, auth.id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Failed to set prefer")
    return {"success": True}


class ProviderModelTypeIn(BaseModel):
    model_type: str


@router.patch("/provider/{id}/model-type", name="update provider model type and set prefer")
async def update_model_type(id: int, data: ProviderModelTypeIn, auth: V1UserAuth = Depends(auth_must)):
    """Update model_type of a provider and set it as preferred."""
    result = ProviderService.update(id, auth.id, {"model_type": data.model_type})
    if not result["success"]:
        raise HTTPException(status_code=404, detail=_("Provider not found"))
    result2 = ProviderService.set_prefer(id, auth.id)
    if not result2["success"]:
        raise HTTPException(status_code=500, detail="Failed to set prefer")
    return result["provider"]
