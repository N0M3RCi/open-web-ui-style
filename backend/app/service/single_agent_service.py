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

import asyncio
import logging
import os
import re
from types import SimpleNamespace
from typing import Any

from camel.agents.chat_agent import AsyncStreamingChatAgentResponse
from camel.responses import ChatAgentResponse
from fastapi import Request

from app.agent.factory.single_agent import single_agent
from app.hands.interface import IHands
from app.memory import (
    build_durable_context_for_task_lock,
    finalize_task_lock_run_memory,
)
from app.model.chat import Chat, sse_json
from app.model.enums import Status
from app.service.task import (
    Action,
    ActionData,
    ActionImproveData,
    TaskLock,
    delete_task_lock,
    set_current_task_id,
)
from app.utils.agent_memory import (
    build_memory_context,
    record_agent_memory_snapshot,
)
from app.utils.file_utils import get_working_directory

logger = logging.getLogger("single_agent_service")

# Char budget for the durable memory bundle (~32k chars at 4 chars/token).
# Override via MERCI_MEMORY_TOKEN_BUDGET if you need to tune in the field.
try:
    _MEMORY_TOKEN_BUDGET = int(
        os.environ.get("MERCI_MEMORY_TOKEN_BUDGET", "8000")
    )
except ValueError:
    _MEMORY_TOKEN_BUDGET = 8000


def _build_single_agent_context(
    task_lock: TaskLock,
    project_context: str | None = None,
    current_user_prompt: str = "",
) -> str:
    # 1. Durable cross-restart context from LocalMemoryStore (M4 path).
    durable = build_durable_context_for_task_lock(
        task_lock,
        mode="single_agent",
        current_user_prompt=current_user_prompt,
        token_budget=_MEMORY_TOKEN_BUDGET,
    )
    if durable:
        return durable + "\n\n"

    # 2. In-process conversation history (hot follow-up turns).
    if getattr(task_lock, "conversation_history", None):
        lines = ["=== Previous Conversation ==="]
        for entry in task_lock.conversation_history:
            role = entry.get("role", "")
            content = entry.get("content", "")
            if role == "task_result" and isinstance(content, dict):
                task_content = content.get("task_content")
                task_result = content.get("task_result")
                if task_content:
                    lines.append(f"Previous task: {task_content}")
                if task_result:
                    lines.append(f"Previous result: {task_result}")
            elif content:
                lines.append(f"{role}: {content}")
        memory_context = build_memory_context(task_lock)
        if memory_context:
            lines.append(memory_context.rstrip())
        lines.append("=== End Previous Conversation ===")
        return "\n".join(lines) + "\n\n"

    # 3. Phase-0 bridge fallback (frontend-sent project_context).
    durable_context = (project_context or "").strip()
    if not durable_context:
        return ""
    return (
        "=== Persisted Project Context ===\n"
        f"{durable_context}\n"
        "=== End Persisted Project Context ===\n\n"
    )


def _finalize_memory_for_turn(
    task_lock: TaskLock,
    *,
    state: str,
    final_result: str | None = None,
    error: str | None = None,
) -> None:
    """Best-effort end-of-run memory write."""

    finalize_task_lock_run_memory(
        task_lock,
        state=state,  # type: ignore[arg-type]
        final_result=final_result,
        error=error,
    )


def _build_single_agent_prompt(
    task_lock: TaskLock,
    question: str,
    attaches: list[str],
    project_context: str | None = None,
) -> str:
    context = _build_single_agent_context(
        task_lock, project_context, current_user_prompt=question
    )
    attachment_context = ""
    if attaches:
        attachment_context = "Attachments:\n" + "\n".join(
            f"- {path}" for path in attaches
        )
        attachment_context += "\n\n"
    return f"{context}{attachment_context}User task:\n{question}"


async def _response_content(
    response: ChatAgentResponse | AsyncStreamingChatAgentResponse,
    task_lock: TaskLock | None = None,
    token_buffer: list[str] | None = None,
    token_event: asyncio.Event | None = None,
) -> tuple[str, int]:
    def extract_tokens(response_chunk: Any) -> int:
        if response_chunk is None:
            return 0
        info = getattr(response_chunk, "info", None) or {}
        usage_info = info.get("usage") or info.get("token_usage") or {}
        return int(usage_info.get("total_tokens", 0) or 0)

    if isinstance(response, AsyncStreamingChatAgentResponse):
        content = ""
        last_chunk = None
        async for chunk in response:
            last_chunk = chunk
            if chunk.msg and chunk.msg.content:
                delta = chunk.msg.content
                content += delta
                # Write directly to the shared token buffer for immediate
                # SSE delivery, bypassing the task lock queue.
                if token_buffer is not None and token_event is not None:
                    token_buffer.append(delta)
                    token_event.set()
        return content, extract_tokens(last_chunk)

    msg = getattr(response, "msg", None)
    usage_tokens = extract_tokens(response)
    if msg is not None and getattr(msg, "content", None):
        return msg.content, usage_tokens

    msgs = getattr(response, "msgs", None)
    if msgs:
        return getattr(msgs[-1], "content", "") or "", usage_tokens

    return "", usage_tokens


def _action_to_sse(item: ActionData) -> str | None:
    if item.action == Action.create_agent:
        return sse_json("create_agent", item.data)
    if item.action == Action.activate_agent:
        return sse_json("activate_agent", item.data)
    if item.action == Action.deactivate_agent:
        return sse_json("deactivate_agent", item.data)
    if item.action == Action.assign_task:
        return sse_json("assign_task", item.data)
    if item.action == Action.activate_toolkit:
        return sse_json("activate_toolkit", item.data)
    if item.action == Action.deactivate_toolkit:
        return sse_json("deactivate_toolkit", item.data)
    if item.action == Action.write_file:
        return sse_json(
            "write_file",
            {
                "file_path": item.data,
                "process_task_id": item.process_task_id,
            },
        )
    if item.action == Action.ask:
        return sse_json("ask", item.data)
    if item.action == Action.notice:
        return sse_json(
            "notice",
            {
                "notice": item.data,
                "process_task_id": item.process_task_id,
            },
        )
    if item.action == Action.terminal:
        return sse_json(
            "terminal",
            {
                "output": item.data,
                "process_task_id": item.process_task_id,
            },
        )
    if item.action == Action.todo_state:
        return sse_json("todo_state", item.data)
    if item.action == Action.budget_not_enough:
        return sse_json(
            Action.budget_not_enough, {"message": "budget not enough"}
        )
    return None


async def single_agent_solve(
    options: Chat,
    request: Request,
    task_lock: TaskLock,
    hands: IHands | None = None,
):
    pause_event = asyncio.Event()
    pause_event.set()
    agent = None
    running_turn: asyncio.Task[tuple[str, int]] | None = None
    current_task_id = options.task_id

    # Shared token buffer for direct SSE streaming (bypasses the task lock
    # queue, eliminating round-trip latency for token delivery).
    _token_buffer: list[str] = []
    _token_event = asyncio.Event()

    # Fast model to use for simple chat questions.
    _FAST_CHAT_MODEL = "claude-haiku-4-5"

    # Keywords that indicate a question needs toolkits (file ops, browser,
    # terminal, search, image generation, code execution, etc.).
    _TOOL_KEYWORDS = re.compile(
        r"\b(code|file|search|browser|terminal|image|picture|photo|draw|"
        r"generate|create|build|make|deploy|run|execute|write|edit|update|"
        r"delete|install|configure|setup|upload|download|find|search|lookup|"
        r"scrape|crawl|navigate|click|type|scroll|open|save|compile|test|"
        r"debug|commit|push|pull|merge|branch|docker|ssh|curl|api|endpoint|"
        r"database|query|sql|migrate|convert|transform|parse|extract)\b",
        re.IGNORECASE,
    )

    _SIMPLE_CHAT_REGEX = re.compile(
        r"^\s*(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening)|"
        r"what'?s?\s+(up|new)|"
        r"how\s+(are\s+you|is\s+it\s+going)|"
        r"nice\s+to\s+(meet|see)\s+you|"
        r"thanks?\s+(you)?|"
        r"thank\s+you|"
        r"bye|goodbye|see\s+(you|ya)|"
        r"have\s+a\s+good\s+(day|one)|"
        r"what\s+(is|are|can)\s+you\s+\w+|"
        r"who\s+(are|made|created)\s+you|"
        r"tell\s+me\s+(about\s+yourself|a\s+joke)|"
        r"yes|no|ok|okay|sure|fine|great|"
        r"what(\'s| is)\s+(your\s+)?name|"
        r"where\s+(are\s+you\s+from|do\s+you\s+live)|"
        r"how\s+(old|tall|far|big|small|many|much)\s+"
        r"[-a-z]+|"
        r"\w+\s+or\s+\w+\s*[?]?)$",
        re.IGNORECASE,
    )

    def _is_simple_chat(question: str) -> bool:
        """Check if a question is simple chat that doesn't need toolkits.

        A question is considered "simple chat" if it is:
        - Short (<= 200 chars)
        - Doesn't contain tool-related keywords (code, file, search, etc.)
        or matches the explicit greeting/chat regex.
        """
        q = question.strip()
        if len(q) > 200:
            return False
        if _SIMPLE_CHAT_REGEX.match(q):
            return True
        # Heuristic: if the question is short and has no tool-related
        # keywords, treat it as a simple chat question.
        if len(q) <= 200 and not _TOOL_KEYWORDS.search(q):
            return True
        return False

    async def ensure_agent(task_id: str):
        nonlocal agent
        if agent is None:
            # Use lightweight mode for simple chat questions
            if _is_simple_chat(options.question):
                logger.info(
                    "Single Agent: simple chat question detected, "
                    "using lightweight mode (no toolkits)"
                )
                # Disable all toolkits except human for chat-only mode
                lite_toolkit_config = {
                    "human": {"enabled": True},
                    "file": {"enabled": False},
                    "web_deploy": {"enabled": False},
                    "screenshot": {"enabled": False},
                    "skill": {"enabled": False},
                    "todo": {"enabled": False},
                    "search": {"enabled": False},
                    "browser": {"enabled": False},
                    "terminal": {"enabled": False},
                    "web_fetch": {"enabled": False},
                    "planning_worktree": {"enabled": False},
                    "mcp": {"enabled": False},
                    "agent": {"enabled": False},
                }
                lite_options = options.model_copy(
                    update={"toolkit_config": lite_toolkit_config}
                )
                agent = await single_agent(
                    lite_options,
                    task_id=task_id,
                    hands=hands,
                    pause_event=pause_event,
                )
            elif _is_simple_chat(options.question):
                logger.info(
                    "Single Agent: simple chat question detected, "
                    "using fast model with lightweight toolkits"
                )
                lite_toolkit_config = {
                    "human": {"enabled": True},
                    "file": {"enabled": False},
                    "web_deploy": {"enabled": False},
                    "screenshot": {"enabled": False},
                    "skill": {"enabled": False},
                    "todo": {"enabled": False},
                    "search": {"enabled": False},
                    "browser": {"enabled": False},
                    "terminal": {"enabled": False},
                    "web_fetch": {"enabled": False},
                    "planning_worktree": {"enabled": False},
                    "mcp": {"enabled": False},
                    "agent": {"enabled": False},
                    "image": {"enabled": False},
                }
                lite_options = options.model_copy(
                    update={
                        "toolkit_config": lite_toolkit_config,
                        "model_type": _FAST_CHAT_MODEL,
                    }
                )
                agent = await single_agent(
                    lite_options,
                    task_id=task_id,
                    hands=hands,
                    pause_event=pause_event,
                )
            else:
                agent = await single_agent(
                    options,
                    task_id=task_id,
                    hands=hands,
                    pause_event=pause_event,
                )
            # Pre-warm the model connection in the background so the
            # first user request doesn't wait for TCP+TLS handshake.
            _prewarm_model_connection(agent)

        observable_todo = getattr(agent, "_observable_todo_toolkit", None)
        if observable_todo is not None:
            observable_todo.task_id = task_id
            observable_todo.agent_id = agent.agent_id
            observable_todo.emit_todo_state()
        return agent

    def _prewarm_model_connection(
        agent_obj: Any,
    ) -> None:
        """Fire-and-forget model pre-warm to establish TCP+TLS connection.

        Makes a minimal chat completion request (max_tokens=1) through the
        model's async client so the connection is ready before the user's
        first real request arrives.
        """
        try:
            model = getattr(agent_obj, "model", None)
            if model is None:
                return
            client = getattr(model, "_async_client", None)
            if client is None:
                return
            model_type = getattr(model, "model_type", None)
            if model_type is None:
                return

            async def _warmup():
                try:
                    await client.chat.completions.create(
                        model=str(model_type),
                        messages=[
                            {
                                "role": "user",
                                "content": "warmup",
                            }
                        ],
                        max_tokens=1,
                    )
                except Exception:
                    # Swallow all errors — pre-warm is best-effort.
                    pass

            asyncio.create_task(_warmup())
        except Exception:
            # Swallow all errors — pre-warm is best-effort.
            pass

    # Maximum time to wait for a single LLM response before timing out
    # and reporting an error to the user instead of hanging indefinitely.
    _ASTEP_TIMEOUT_SECONDS = 120  # 2 minutes

    async def run_turn(
        question: str,
        attaches: list[str],
        task_id: str,
        project_context: str | None = None,
    ) -> tuple[str, int]:
        turn_agent = await ensure_agent(task_id)
        turn_agent.process_task_id = task_id
        prompt = _build_single_agent_prompt(
            task_lock,
            question,
            attaches,
            project_context,
        )
        try:
            response = await asyncio.wait_for(
                turn_agent.astep(prompt),
                timeout=_ASTEP_TIMEOUT_SECONDS,
            )
            content, total_tokens = await asyncio.wait_for(
                _response_content(
                    response,
                    task_lock=task_lock,
                    token_buffer=_token_buffer,
                    token_event=_token_event,
                ),
                timeout=_ASTEP_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            logger.error(
                "Single Agent turn timed out after %d seconds",
                _ASTEP_TIMEOUT_SECONDS,
                extra={
                    "project_id": options.project_id,
                    "task_id": task_id,
                },
            )
            # Cancel the underlying agent step to free resources
            if turn_agent is not None:
                stop = getattr(turn_agent, "stop_event", None)
                if stop is not None:
                    stop.set()
            raise TimeoutError(
                f"The model did not respond within {_ASTEP_TIMEOUT_SECONDS} "
                "seconds. Please check your model configuration and try "
                "again."
            )
        record_agent_memory_snapshot(
            task_lock,
            turn_agent,
            scope="single_agent",
            task_id=task_id,
            task_content=question,
            task_result=content,
        )
        task_lock.add_conversation(
            "task_result",
            {
                "task_content": question,
                "task_result": content,
                "working_directory": get_working_directory(options, task_lock),
            },
        )
        return content, total_tokens

    pending_queue_get: asyncio.Task[Any] = asyncio.create_task(
        task_lock.get_queue()
    )
    pending_token_event: asyncio.Task | None = None

    try:
        while True:
            if await request.is_disconnected():
                logger.info(
                    "Single Agent client disconnected; pausing session",
                    extra={"project_id": options.project_id},
                )
                pause_event.clear()
                task_lock.status = Status.confirming
                if running_turn and not running_turn.done():
                    running_turn.cancel()
                break

            wait_for = {pending_queue_get}
            if running_turn is not None:
                wait_for.add(running_turn)
            if pending_token_event is not None and not pending_token_event.done():
                wait_for.add(pending_token_event)

            done, _ = await asyncio.wait(
                wait_for,
                timeout=1.0,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if not done:
                continue

            # Drain streaming token buffer directly (bypasses queue).
            if pending_token_event is not None and pending_token_event in done:
                tokens = list(_token_buffer)
                _token_buffer.clear()
                _token_event.clear()
                # Re-create the watcher for next token batch.
                pending_token_event = asyncio.create_task(
                    _token_event.wait()
                )
                for token in tokens:
                    yield sse_json("token", {"content": token})
                continue

            if pending_queue_get in done:
                item = pending_queue_get.result()
                pending_queue_get = asyncio.create_task(task_lock.get_queue())

                if item.action == Action.improve:
                    assert isinstance(item, ActionImproveData)
                    if item.new_task_id:
                        current_task_id = item.new_task_id
                        set_current_task_id(
                            options.project_id, current_task_id
                        )

                    if running_turn is not None and not running_turn.done():
                        yield sse_json(
                            "error",
                            {
                                "message": (
                                    "Single Agent is already processing a task."
                                )
                            },
                        )
                        continue

                    pause_event.set()
                    task_lock.status = Status.processing
                    yield sse_json(
                        "confirmed", {"question": item.data.question}
                    )
                    running_turn = asyncio.create_task(
                        run_turn(
                            item.data.question,
                            item.data.attaches or [],
                            current_task_id,
                            item.data.project_context
                            or options.project_context,
                        )
                    )
                    task_lock.add_background_task(running_turn)
                    # Start watching for streaming token events (bypasses queue).
                    pending_token_event = asyncio.create_task(
                        _token_event.wait()
                    )
                    continue

                if item.action == Action.pause:
                    pause_event.clear()
                    task_lock.status = Status.confirming
                    continue

                if item.action == Action.resume:
                    pause_event.set()
                    task_lock.status = Status.processing
                    continue

                if item.action == Action.skip_task:
                    pause_event.clear()
                    stop_message = (
                        "<summary>Task stopped</summary>Task stopped by user"
                    )
                    cancelled_turn = running_turn
                    # Drop our reference first so the next asyncio.wait does
                    # not block on the cancelled task, and so the duplicate
                    # "end" path further down cannot re-surface it.
                    running_turn = None
                    if (
                        cancelled_turn is not None
                        and not cancelled_turn.done()
                    ):
                        cancelled_turn.cancel()

                        # Attach a done callback that swallows CancelledError /
                        # whatever exception the turn surfaces post-cancel, so
                        # the asyncio loop does not log "Task exception was
                        # never retrieved". We deliberately do NOT await the
                        # task here: model HTTP calls, browser actions, or
                        # MCP tool calls may not propagate CancelledError
                        # promptly, and awaiting would block the SSE response
                        # generator -- the user would press Skip and see
                        # nothing happen.
                        def _swallow(task: asyncio.Task) -> None:
                            try:
                                task.result()
                            except (asyncio.CancelledError, Exception):
                                pass

                        cancelled_turn.add_done_callback(_swallow)
                    task_lock.status = Status.done
                    _finalize_memory_for_turn(
                        task_lock,
                        state="cancelled",
                        final_result=stop_message,
                    )
                    yield sse_json("end", stop_message)
                    continue

                if item.action == Action.stop:
                    pause_event.clear()
                    if agent is not None and getattr(
                        agent, "stop_event", None
                    ):
                        agent.stop_event.set()
                    if running_turn is not None and not running_turn.done():
                        running_turn.cancel()
                    await delete_task_lock(task_lock.id)
                    break

                payload = _action_to_sse(item)
                if payload is not None:
                    if item.action == Action.budget_not_enough:
                        pause_event.clear()
                        task_lock.status = Status.confirming
                    yield payload
                continue

            if running_turn is not None and running_turn in done:
                try:
                    final_result, total_tokens = running_turn.result()
                except asyncio.CancelledError:
                    final_result = "<summary>Task paused</summary>Task paused"
                    total_tokens = 0
                    pending_token_event = None
                except Exception as e:
                    logger.error(
                        "Single Agent turn failed",
                        extra={
                            "project_id": options.project_id,
                            "task_id": current_task_id,
                        },
                        exc_info=True,
                    )
                    pause_event.clear()
                    task_lock.status = Status.confirming
                    _finalize_memory_for_turn(
                        task_lock, state="failed", error=str(e)
                    )
                    yield sse_json("error", {"message": str(e)})
                    running_turn = None
                    pending_token_event = None
                    continue

                task_lock.status = Status.done
                running_turn = None
                pending_token_event = None
                _finalize_memory_for_turn(
                    task_lock,
                    state="done",
                    final_result=final_result,
                )
                yield sse_json(
                    "end",
                    {"message": final_result, "tokens": total_tokens},
                )
                continue
    finally:
        if pending_queue_get is not None and not pending_queue_get.done():
            pending_queue_get.cancel()
        if pending_token_event is not None and not pending_token_event.done():
            pending_token_event.cancel()
        if running_turn is not None and not running_turn.done():
            pause_event.clear()
            task_lock.status = Status.confirming
            running_turn.cancel()
        # If the loop exits without a clean done/failed end-of-turn (client
        # disconnect, stop, exception), record a cancelled run. The
        # `_memory_finalized_runs` set on task_lock makes this idempotent:
        # a prior done/failed write wins, this only catches the unfinished
        # case.
        _finalize_memory_for_turn(task_lock, state="cancelled")
        if agent is not None:
            release_cdp = getattr(agent, "_cdp_release_callback", None)
            if callable(release_cdp):
                try:
                    release_cdp(agent)
                except Exception:
                    logger.warning(
                        "Failed to release Single Agent browser resource",
                        extra={
                            "project_id": options.project_id,
                            "task_id": current_task_id,
                        },
                        exc_info=True,
                    )
