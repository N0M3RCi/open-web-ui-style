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

import os
from typing import Literal

from openai import OpenAI
from PIL import Image

from camel.toolkits import OpenAIImageToolkit as BaseOpenAIImageToolkit

from app.agent.toolkit.abstract_toolkit import AbstractToolkit
from app.service.task import Agents
from app.utils.listen.toolkit_listen import auto_listen_toolkit, listen_toolkit


_STANDARD_MODELS = frozenset({
    "gpt-image-1", "dall-e-3", "dall-e-2",
    "grok-2-image", "grok-2-image-latest", "grok-2-image-1212",
})


@auto_listen_toolkit(BaseOpenAIImageToolkit)
class OpenAIImageToolkit(BaseOpenAIImageToolkit, AbstractToolkit):
    agent_name: str = Agents.single_agent

    def __init__(
        self,
        api_task_id: str,
        model: str = "gpt-image-1",
        timeout: float | None = None,
        api_key: str | None = None,
        url: str | None = None,
        size: str | None = "1024x1024",
        quality: str | None = "standard",
        response_format: str | None = "b64_json",
        background: str | None = "auto",
        style: str | None = None,
        working_directory: str | None = None,
    ):
        self.api_task_id = api_task_id
        self._is_standard_model = model in _STANDARD_MODELS

        if self._is_standard_model:
            # Standard model — use CAMEL parent init
            super().__init__(
                model,
                timeout,
                api_key,
                url,
                size,
                quality,
                response_format,
                background,
                style,
                working_directory,
            )
        else:
            # Custom model (e.g. FLUX via NEAR AI) — handle directly
            super(BaseOpenAIImageToolkit, self).__init__(timeout=timeout)
            resolved_key = api_key or os.getenv("OPENAI_API_KEY", "")
            resolved_url = url or os.getenv("OPENAI_API_BASE_URL")
            self.client = OpenAI(api_key=resolved_key, base_url=resolved_url)
            self.model = model
            self.size = size
            self.quality = quality
            self.response_format = response_format
            self.background = background
            self.style = style
            self.working_directory = working_directory or "image_save"

    @listen_toolkit(BaseOpenAIImageToolkit.generate_image)
    def generate_image(
        self,
        prompt: str,
        image_name: str | list[str] = "image.png",
        n: int = 1,
    ) -> str:
        # Validate image_name ends with .png
        if isinstance(image_name, str):
            if not image_name.endswith(".png"):
                return (
                    f"Error: Image name must end with .png, got: {image_name}"
                )
        elif isinstance(image_name, list):
            for name in image_name:
                if not name.endswith(".png"):
                    return f"Error: All image names must end with .png, got: {name}"

        return super().generate_image(prompt, image_name, n)

    def _build_base_params(self, prompt: str, n: int | None = None) -> dict:
        params = super()._build_base_params(prompt, n)
        params["user"] = self.api_task_id  # support cloud key billing
        return params