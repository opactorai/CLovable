"""Gemini CLI provider implementation using ACP over stdio.

This adapter launches `gemini --experimental-acp`, communicates via JSON-RPC
over stdio, and streams session/update notifications. Thought chunks are
surfaced to the UI.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict, List, Optional

from app.core.terminal_ui import ui
from app.models.messages import Message

from ..base import BaseCLI, CLIType
from .qwen_cli import _ACPClient, _mime_for  # Reuse minimal ACP client


class GeminiCLI(BaseCLI):
    """Gemini CLI via ACP. Streams message and thought chunks to UI."""

    _SHARED_CLIENT: Optional[_ACPClient] = None
    _SHARED_INITIALIZED: bool = False

    def __init__(self, db_session=None):
        super().__init__(CLIType.GEMINI)
        self.db_session = db_session
        self._session_store: Dict[str, str] = {}
        self._client: Optional[_ACPClient] = None
        self._initialized = False

    async def check_availability(self) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_shell(
                "gemini --help",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": "Gemini CLI not found. Install Gemini CLI and ensure it is in PATH.",
                }
            return {
                "available": True,
                "configured": True,
                "models": self.get_supported_models(),
                "default_models": [],
            }
        except Exception as e:
            return {"available": False, "configured": False, "error": str(e)}

    async def _ensure_provider_md(self, project_path: str) -> None:
        """Ensure GEMINI.md exists at the project repo root.

        Mirrors CursorAgent behavior: copy app/prompt/system-prompt.md if present.
        """
        try:
            project_repo_path = os.path.join(project_path, "repo")
            if not os.path.exists(project_repo_path):
                project_repo_path = project_path
            md_path = os.path.join(project_repo_path, "GEMINI.md")
            if os.path.exists(md_path):
                ui.debug(f"GEMINI.md already exists at: {md_path}", "Gemini")
                return
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            app_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))
            system_prompt_path = os.path.join(app_dir, "prompt", "system-prompt.md")
            content = "# GEMINI\n\n"
            if os.path.exists(system_prompt_path):
                try:
                    with open(system_prompt_path, "r", encoding="utf-8") as f:
                        content += f.read()
                except Exception:
                    pass
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(content)
            ui.success(f"Created GEMINI.md at: {md_path}", "Gemini")
        except Exception as e:
            ui.warning(f"Failed to create GEMINI.md: {e}", "Gemini")

    async def _ensure_client(self) -> _ACPClient:
        if GeminiCLI._SHARED_CLIENT is None:
            cmd = ["gemini", "--experimental-acp"]
            env = os.environ.copy()
            # Prefer device-code-like flow if CLI supports it
            env.setdefault("NO_BROWSER", "1")
            GeminiCLI._SHARED_CLIENT = _ACPClient(cmd, env=env)

            # Client-side request handlers: auto-approve permissions
            async def _handle_permission(params: Dict[str, Any]) -> Dict[str, Any]:
                options = params.get("options") or []
                chosen = None
                for kind in ("allow_always", "allow_once"):
                    chosen = next((o for o in options if o.get("kind") == kind), None)
                    if chosen:
                        break
                if not chosen and options:
                    chosen = options[0]
                if not chosen:
                    return {"outcome": {"outcome": "cancelled"}}
                return {
                    "outcome": {"outcome": "selected", "optionId": chosen.get("optionId")}
                }

            async def _fs_read(params: Dict[str, Any]) -> Dict[str, Any]:
                return {"content": ""}

            async def _fs_write(params: Dict[str, Any]) -> Dict[str, Any]:
                return {}

            GeminiCLI._SHARED_CLIENT.on_request("session/request_permission", _handle_permission)
            GeminiCLI._SHARED_CLIENT.on_request("fs/read_text_file", _fs_read)
            GeminiCLI._SHARED_CLIENT.on_request("fs/write_text_file", _fs_write)

            await GeminiCLI._SHARED_CLIENT.start()

        self._client = GeminiCLI._SHARED_CLIENT

        if not GeminiCLI._SHARED_INITIALIZED:
            await self._client.request(
                "initialize",
                {
                    "clientCapabilities": {
                        "fs": {"readTextFile": False, "writeTextFile": False}
                    },
                    "protocolVersion": 1,
                },
            )
            GeminiCLI._SHARED_INITIALIZED = True
        return self._client

    async def execute_with_streaming(
        self,
        instruction: str,
        project_path: str,
        session_id: Optional[str] = None,
        log_callback: Optional[Callable[[str], Any]] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False,
    ) -> AsyncGenerator[Message, None]:
        client = await self._ensure_client()
        # Ensure provider markdown exists in project repo
        await self._ensure_provider_md(project_path)
        turn_id = str(uuid.uuid4())[:8]
        try:
            ui.debug(
                f"[{turn_id}] execute_with_streaming start | model={model or '-'} | images={len(images or [])} | instruction_len={len(instruction or '')}",
                "Gemini",
            )
        except Exception:
            pass

        # Resolve repo cwd
        project_repo_path = os.path.join(project_path, "repo")
        if not os.path.exists(project_repo_path):
            project_repo_path = project_path

        # Project ID
        path_parts = project_path.split("/")
        project_id = (
            path_parts[path_parts.index("repo") - 1]
            if "repo" in path_parts and path_parts.index("repo") > 0
            else path_parts[-1]
        )

        # Ensure session
        stored_session_id = await self.get_session_id(project_id)
        ui.debug(f"[{turn_id}] resolved project_id={project_id}", "Gemini")
        if not stored_session_id:
            # Try creating a session to reuse cached OAuth credentials if present
            try:
                result = await client.request(
                    "session/new", {"cwd": project_repo_path, "mcpServers": []}
                )
                stored_session_id = result.get("sessionId")
                if stored_session_id:
                    await self.set_session_id(project_id, stored_session_id)
                    ui.info(f"[{turn_id}] session created: {stored_session_id}", "Gemini")
            except Exception as e:
                # Authenticate then retry session/new
                auth_method = os.getenv("GEMINI_AUTH_METHOD", "oauth-personal")
                ui.warning(
                    f"[{turn_id}] session/new failed; authenticating via {auth_method}: {e}",
                    "Gemini",
                )
                try:
                    await client.request("authenticate", {"methodId": auth_method})
                    result = await client.request(
                        "session/new", {"cwd": project_repo_path, "mcpServers": []}
                    )
                    stored_session_id = result.get("sessionId")
                    if stored_session_id:
                        await self.set_session_id(project_id, stored_session_id)
                        ui.info(f"[{turn_id}] session created after auth: {stored_session_id}", "Gemini")
                except Exception as e2:
                    ui.error(f"[{turn_id}] authentication/session failed: {e2}", "Gemini")
                    yield Message(
                        id=str(uuid.uuid4()),
                        project_id=project_path,
                        role="assistant",
                        message_type="error",
                        content=f"Gemini authentication/session failed: {e2}",
                        metadata_json={"cli_type": self.cli_type.value},
                        session_id=session_id,
                        created_at=datetime.utcnow(),
                    )
                    return

        q: asyncio.Queue = asyncio.Queue()
        thought_buffer: List[str] = []
        text_buffer: List[str] = []

        def _on_update(params: Dict[str, Any]) -> None:
            try:
                if params.get("sessionId") != stored_session_id:
                    return
                update = params.get("update") or {}
                try:
                    kind = update.get("sessionUpdate") or update.get("type")
                    snippet = ""
                    if isinstance(update.get("text"), str):
                        snippet = update.get("text")[:80]
                    elif isinstance((update.get("content") or {}).get("text"), str):
                        snippet = (update.get("content") or {}).get("text")[:80]
                    ui.debug(
                        f"[{turn_id}] notif session/update kind={kind} snippet={snippet!r}",
                        "Gemini",
                    )
                except Exception:
                    pass
                q.put_nowait(update)
            except Exception:
                pass

        client.on_notification("session/update", _on_update)

        # Build prompt parts
        parts: List[Dict[str, Any]] = []
        if instruction:
            parts.append({"type": "text", "text": instruction})
        if images:
            def _iget(obj, key, default=None):
                try:
                    if isinstance(obj, dict):
                        return obj.get(key, default)
                    return getattr(obj, key, default)
                except Exception:
                    return default

            for image in images:
                local_path = _iget(image, "path")
                b64 = _iget(image, "base64_data") or _iget(image, "data")
                if not b64 and _iget(image, "url", "").startswith("data:"):
                    try:
                        b64 = _iget(image, "url").split(",", 1)[1]
                    except Exception:
                        b64 = None
                if local_path and os.path.exists(local_path):
                    try:
                        with open(local_path, "rb") as f:
                            data = f.read()
                        mime = _mime_for(local_path)
                        b64 = base64.b64encode(data).decode("utf-8")
                        parts.append({"type": "image", "mimeType": mime, "data": b64})
                        continue
                    except Exception:
                        pass
                if b64:
                    parts.append({"type": "image", "mimeType": "image/png", "data": b64})

        # Send prompt
        def _make_prompt_task() -> asyncio.Task:
            ui.debug(f"[{turn_id}] sending session/prompt (parts={len(parts)})", "Gemini")
            return asyncio.create_task(
                client.request(
                    "session/prompt", {"sessionId": stored_session_id, "prompt": parts}
                )
            )
        prompt_task = _make_prompt_task()

        while True:
            done, _ = await asyncio.wait(
                {prompt_task, asyncio.create_task(q.get())},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if prompt_task in done:
                ui.debug(f"[{turn_id}] prompt_task completed; draining updates", "Gemini")
                # Drain remaining
                while not q.empty():
                    update = q.get_nowait()
                    async for m in self._update_to_messages(update, project_path, session_id, thought_buffer, text_buffer):
                        if m:
                            yield m
                exc = prompt_task.exception()
                if exc:
                    msg = str(exc)
                    if "Session not found" in msg or "session not found" in msg.lower():
                        ui.warning(f"[{turn_id}] session expired; creating a new session and retrying", "Gemini")
                        try:
                            result = await client.request(
                                "session/new", {"cwd": project_repo_path, "mcpServers": []}
                            )
                            stored_session_id = result.get("sessionId")
                            if stored_session_id:
                                await self.set_session_id(project_id, stored_session_id)
                                ui.info(f"[{turn_id}] new session={stored_session_id}; retrying prompt", "Gemini")
                                prompt_task = _make_prompt_task()
                                continue
                        except Exception as e2:
                            ui.error(f"[{turn_id}] session recovery failed: {e2}", "Gemini")
                            yield Message(
                                id=str(uuid.uuid4()),
                                project_id=project_path,
                                role="assistant",
                                message_type="error",
                                content=f"Gemini session recovery failed: {e2}",
                                metadata_json={"cli_type": self.cli_type.value},
                                session_id=session_id,
                                created_at=datetime.utcnow(),
                            )
                    else:
                        ui.error(f"[{turn_id}] prompt error: {msg}", "Gemini")
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="error",
                            content=f"Gemini prompt error: {msg}",
                            metadata_json={"cli_type": self.cli_type.value},
                            session_id=session_id,
                            created_at=datetime.utcnow(),
                        )
                # Final flush of buffered assistant content (with <thinking> block)
                if thought_buffer or text_buffer:
                    ui.debug(
                        f"[{turn_id}] flushing buffered content thought_len={sum(len(x) for x in thought_buffer)} text_len={sum(len(x) for x in text_buffer)}",
                        "Gemini",
                    )
                    yield Message(
                        id=str(uuid.uuid4()),
                        project_id=project_path,
                        role="assistant",
                        message_type="chat",
                        content=self._compose_content(thought_buffer, text_buffer),
                        metadata_json={"cli_type": self.cli_type.value},
                        session_id=session_id,
                        created_at=datetime.utcnow(),
                    )
                    thought_buffer.clear()
                    text_buffer.clear()
                break
            for task in done:
                if task is not prompt_task:
                    update = task.result()
                    try:
                        kind = update.get("sessionUpdate") or update.get("type")
                        ui.debug(f"[{turn_id}] processing update kind={kind}", "Gemini")
                    except Exception:
                        pass
                    async for m in self._update_to_messages(update, project_path, session_id, thought_buffer, text_buffer):
                        if m:
                            yield m

        yield Message(
            id=str(uuid.uuid4()),
            project_id=project_path,
            role="system",
            message_type="result",
            content="Gemini turn completed",
            metadata_json={"cli_type": self.cli_type.value, "hidden_from_ui": True},
            session_id=session_id,
            created_at=datetime.utcnow(),
        )
        ui.info(f"[{turn_id}] turn completed", "Gemini")

    async def _update_to_messages(
        self,
        update: Dict[str, Any],
        project_path: str,
        session_id: Optional[str],
        thought_buffer: List[str],
        text_buffer: List[str],
    ) -> AsyncGenerator[Optional[Message], None]:
        kind = update.get("sessionUpdate") or update.get("type")
        now = datetime.utcnow()
        if kind in ("agent_message_chunk", "agent_thought_chunk"):
            text = ((update.get("content") or {}).get("text")) or update.get("text") or ""
            try:
                ui.debug(
                    f"update chunk kind={kind} len={len(text or '')}",
                    "Gemini",
                )
            except Exception:
                pass
            if not isinstance(text, str):
                text = str(text)
            if kind == "agent_thought_chunk":
                thought_buffer.append(text)
            else:
                # First assistant message chunk after thinking: render thinking immediately
                if thought_buffer and not text_buffer:
                    yield Message(
                        id=str(uuid.uuid4()),
                        project_id=project_path,
                        role="assistant",
                        message_type="chat",
                        content=self._compose_content(thought_buffer, []),
                        metadata_json={"cli_type": self.cli_type.value, "event_type": "thinking"},
                        session_id=session_id,
                        created_at=now,
                    )
                    thought_buffer.clear()
                text_buffer.append(text)
            return
        elif kind in ("tool_call", "tool_call_update"):
            tool_name = self._parse_tool_name(update)
            tool_input = self._extract_tool_input(update)
            normalized = self._normalize_tool_name(tool_name) if hasattr(self, '_normalize_tool_name') else tool_name
            # Render policy:
            # - Non-Write tools: render only on tool_call (start)
            # - Write tool: render only on tool_call_update (Gemini often emits updates only)
            should_render = False
            if (normalized == "Write" and kind == "tool_call_update") or (
                normalized != "Write" and kind == "tool_call"
            ):
                should_render = True
            if not should_render:
                try:
                    ui.debug(
                        f"skip tool event kind={kind} name={tool_name} normalized={normalized}",
                        "Gemini",
                    )
                except Exception:
                    pass
                return
            try:
                ui.info(
                    f"tool event kind={kind} name={tool_name} input={tool_input}",
                    "Gemini",
                )
            except Exception:
                pass
            summary = self._create_tool_summary(tool_name, tool_input)
            # Flush buffered chat before tool use
            if thought_buffer or text_buffer:
                yield Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=self._compose_content(thought_buffer, text_buffer),
                    metadata_json={"cli_type": self.cli_type.value},
                    session_id=session_id,
                    created_at=now,
                )
                thought_buffer.clear()
                text_buffer.clear()
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="tool_use",
                content=summary,
                metadata_json={
                    "cli_type": self.cli_type.value,
                    "event_type": kind,
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                },
                session_id=session_id,
                created_at=now,
            )
        elif kind == "plan":
            try:
                ui.info("plan event received", "Gemini")
            except Exception:
                pass
            entries = update.get("entries") or []
            lines = []
            for e in entries[:6]:
                title = e.get("title") if isinstance(e, dict) else str(e)
                if title:
                    lines.append(f"• {title}")
            content = "\n".join(lines) if lines else "Planning…"
            if thought_buffer or text_buffer:
                yield Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=self._compose_content(thought_buffer, text_buffer),
                    metadata_json={"cli_type": self.cli_type.value},
                    session_id=session_id,
                    created_at=now,
                )
            thought_buffer.clear()
            text_buffer.clear()
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="chat",
                content=content,
                metadata_json={"cli_type": self.cli_type.value, "event_type": "plan"},
                session_id=session_id,
                created_at=now,
            )

    def _compose_content(self, thought_buffer: List[str], text_buffer: List[str]) -> str:
        parts: List[str] = []
        if thought_buffer:
            thinking = "".join(thought_buffer).strip()
            if thinking:
                parts.append(f"<thinking>\n{thinking}\n</thinking>\n")
        if text_buffer:
            parts.append("".join(text_buffer))
        return "".join(parts)

    def _parse_tool_name(self, update: Dict[str, Any]) -> str:
        raw_id = update.get("toolCallId") or ""
        if isinstance(raw_id, str) and raw_id:
            base = raw_id.split("-", 1)[0]
            return base or (update.get("title") or update.get("kind") or "tool")
        return update.get("title") or update.get("kind") or "tool"

    def _extract_tool_input(self, update: Dict[str, Any]) -> Dict[str, Any]:
        tool_input: Dict[str, Any] = {}
        path: Optional[str] = None
        locs = update.get("locations")
        if isinstance(locs, list) and locs:
            first = locs[0]
            if isinstance(first, dict):
                path = (
                    first.get("path")
                    or first.get("file")
                    or first.get("file_path")
                    or first.get("filePath")
                    or first.get("uri")
                )
                if isinstance(path, str) and path.startswith("file://"):
                    path = path[len("file://"):]
        if not path:
            content = update.get("content")
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict):
                        cand = (
                            c.get("path")
                            or c.get("file")
                            or c.get("file_path")
                            or (c.get("args") or {}).get("path")
                        )
                        if cand:
                            path = cand
                            break
        if path:
            tool_input["path"] = str(path)
        return tool_input

    async def get_session_id(self, project_id: str) -> Optional[str]:
        if self.db_session:
            try:
                from app.models.projects import Project

                project = (
                    self.db_session.query(Project)
                    .filter(Project.id == project_id)
                    .first()
                )
                if project and project.active_cursor_session_id:
                    try:
                        data = json.loads(project.active_cursor_session_id)
                        if isinstance(data, dict) and "gemini" in data:
                            return data["gemini"]
                    except Exception:
                        pass
            except Exception as e:
                ui.warning(f"Gemini get_session_id DB error: {e}", "Gemini")
        return self._session_store.get(project_id)

    async def set_session_id(self, project_id: str, session_id: str) -> None:
        if self.db_session:
            try:
                from app.models.projects import Project

                project = (
                    self.db_session.query(Project)
                    .filter(Project.id == project_id)
                    .first()
                )
                if project:
                    data: Dict[str, Any] = {}
                    if project.active_cursor_session_id:
                        try:
                            val = json.loads(project.active_cursor_session_id)
                            if isinstance(val, dict):
                                data = val
                            else:
                                data = {"cursor": val}
                        except Exception:
                            data = {"cursor": project.active_cursor_session_id}
                    data["gemini"] = session_id
                    project.active_cursor_session_id = json.dumps(data)
                    self.db_session.commit()
            except Exception as e:
                ui.warning(f"Gemini set_session_id DB error: {e}", "Gemini")
        self._session_store[project_id] = session_id


__all__ = ["GeminiCLI"]
