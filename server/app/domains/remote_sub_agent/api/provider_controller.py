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
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi_babel import _
from pydantic import BaseModel

from app.domains.remote_sub_agent.service.provider_service import (
    RemoteSubAgentProviderService,
)
from app.model.remote_sub_agent.provider import (
    RemoteSubAgentProviderIn,
    RemoteSubAgentProviderOut,
)
from app.shared.auth import auth_must
from app.shared.auth.user_auth import V1UserAuth

router = APIRouter(tags=["Remote Sub Agent Provider Management"])


class RemoteSubAgentValidateIn(BaseModel):
    provider: str
    api_key: str
    base_url: str
    agent_name: str = ""


class RemoteSubAgentValidateOut(BaseModel):
    is_valid: bool
    message: str = ""


@router.post("/remote-sub-agent/validate", name="validate remote sub agent")
async def validate_remote_sub_agent(data: RemoteSubAgentValidateIn):
    """Validate a remote sub agent configuration by testing the API connection."""
    if not data.api_key.strip():
        return RemoteSubAgentValidateOut(is_valid=False, message="API key is required")
    if not data.base_url.strip():
        return RemoteSubAgentValidateOut(is_valid=False, message="Base URL is required")

    base_url = data.base_url.rstrip("/")
    test_url = f"{base_url}/models?key={data.api_key}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(test_url)
            if resp.status_code == 200:
                models = resp.json()
                model_count = len(models.get("models", []))
                if model_count > 0:
                    return RemoteSubAgentValidateOut(
                        is_valid=True,
                        message=f"Connected successfully. Found {model_count} models.",
                    )
                return RemoteSubAgentValidateOut(
                    is_valid=True,
                    message="Connected successfully.",
                )
            elif resp.status_code == 403:
                return RemoteSubAgentValidateOut(
                    is_valid=False,
                    message="API key is invalid or does not have access.",
                )
            else:
                return RemoteSubAgentValidateOut(
                    is_valid=False,
                    message=f"API returned HTTP {resp.status_code}: {resp.text[:200]}",
                )
    except httpx.TimeoutException:
        return RemoteSubAgentValidateOut(
            is_valid=False,
            message="Connection timed out. Check the base URL.",
        )
    except Exception as e:
        return RemoteSubAgentValidateOut(
            is_valid=False,
            message=f"Connection failed: {str(e)[:200]}",
        )


@router.get(
    "/remote-sub-agent-providers",
    name="list remote sub agent providers",
    response_model=list[RemoteSubAgentProviderOut],
)
async def list_remote_sub_agent_providers(
    provider_name: str | None = None,
    enabled: bool | None = Query(None),
    auth: V1UserAuth = Depends(auth_must),
) -> list[RemoteSubAgentProviderOut]:
    return RemoteSubAgentProviderService.list_for_user(
        auth.id,
        provider_name=provider_name,
        enabled=enabled,
    )


@router.get(
    "/remote-sub-agent-providers/{provider_id}",
    name="get remote sub agent provider detail",
    response_model=RemoteSubAgentProviderOut,
)
async def get_remote_sub_agent_provider(
    provider_id: int,
    auth: V1UserAuth = Depends(auth_must),
):
    model = RemoteSubAgentProviderService.get(provider_id, auth.id)
    if not model:
        raise HTTPException(
            status_code=404,
            detail=_("Remote sub agent provider not found"),
        )
    return model


@router.post(
    "/remote-sub-agent-providers",
    name="create remote sub agent provider",
    response_model=RemoteSubAgentProviderOut,
)
async def create_remote_sub_agent_provider(
    data: RemoteSubAgentProviderIn,
    auth: V1UserAuth = Depends(auth_must),
):
    result = RemoteSubAgentProviderService.create(
        auth.id,
        data.model_dump(),
    )
    return result["provider"]


@router.put(
    "/remote-sub-agent-providers/{provider_id}",
    name="update remote sub agent provider",
    response_model=RemoteSubAgentProviderOut,
)
async def update_remote_sub_agent_provider(
    provider_id: int,
    data: RemoteSubAgentProviderIn,
    auth: V1UserAuth = Depends(auth_must),
):
    result = RemoteSubAgentProviderService.update(
        provider_id,
        auth.id,
        data.model_dump(),
    )
    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=_("Remote sub agent provider not found"),
        )
    return result["provider"]


@router.delete(
    "/remote-sub-agent-providers/{provider_id}",
    name="delete remote sub agent provider",
)
async def delete_remote_sub_agent_provider(
    provider_id: int,
    auth: V1UserAuth = Depends(auth_must),
):
    if not RemoteSubAgentProviderService.delete(provider_id, auth.id):
        raise HTTPException(
            status_code=404,
            detail=_("Remote sub agent provider not found"),
        )
    return Response(status_code=204)
