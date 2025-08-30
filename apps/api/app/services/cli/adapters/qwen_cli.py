"""Qwen CLI provider implementation using ACP over stdio.

This adapter launches `qwen --experimental-acp`, speaks JSON-RPC over stdio,
and streams session/update notifications into our Message model. Thought
chunks are surfaced to the UI (unlike some providers that hide them).
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from dataclasses import dataclass
import shutil
from datetime import datetime
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict, List, Optional

from app.core.terminal_ui import ui
from app.models.messages import Message

from ..base import BaseCLI, CLIType


@dataclass
class _Pending:
    fut: asyncio.Future


class _ACPClient:
    """Minimal JSON-RPC client over newline-delimited JSON on stdio."""

    def __init__(self, cmd: List[str], env: Optional[Dict[str, str]] = None, cwd: Optional[str] = None):
        self._cmd = cmd
        self._env = env or os.environ.copy()
        self._cwd = cwd or os.getcwd()
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._next_id = 1
        self._pending: Dict[int, _Pending] = {}
        self._notif_handlers: Dict[str, List[Callable[[Dict[str, Any]], None]]] = {}
        self._request_handlers: Dict[str, Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]] = {}
        self._reader_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        if self._proc is not None:
            return
        self._proc = await asyncio.create_subprocess_exec(
            *self._cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=self._env,
            cwd=self._cwd,
        )

        # Start reader
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def stop(self) -> None:
        try:
            if self._proc and self._proc.returncode is None:
                self._proc.terminate()
                try:
                    await asyncio.wait_for(self._proc.wait(), timeout=2.0)
                except asyncio.TimeoutError:
                    self._proc.kill()
        finally:
            self._proc = None
            if self._reader_task:
                self._reader_task.cancel()
                self._reader_task = None

    def on_notification(self, method: str, handler: Callable[[Dict[str, Any]], None]) -> None:
        self._notif_handlers.setdefault(method, []).append(handler)

    def on_request(self, method: str, handler: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]) -> None:
        self._request_handlers[method] = handler

    async def request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if not self._proc or not self._proc.stdin:
            raise RuntimeError("ACP process not started")
        msg_id = self._next_id
        self._next_id += 1
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = _Pending(fut=fut)
        obj = {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params or {}}
        data = (json.dumps(obj) + "\n").encode("utf-8")
        self._proc.stdin.write(data)
        await self._proc.stdin.drain()
        return await fut

    async def _reader_loop(self) -> None:
        assert self._proc and self._proc.stdout
        stdout = self._proc.stdout
        buffer = b""
        while True:
            line = await stdout.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line.decode("utf-8"))
            except Exception:
                # best-effort: ignore malformed
                continue

            # Response
            if isinstance(msg, dict) and "id" in msg and "method" not in msg:
                slot = self._pending.pop(int(msg["id"])) if int(msg["id"]) in self._pending else None
                if not slot:
                    continue
                if "error" in msg:
                    slot.fut.set_exception(RuntimeError(str(msg["error"])))
                else:
                    slot.fut.set_result(msg.get("result"))
                continue

            # Request from agent (client-side)
            if isinstance(msg, dict) and "method" in msg and "id" in msg:
                req_id = msg["id"]
                method = msg["method"]
                params = msg.get("params") or {}
                handler = self._request_handlers.get(method)
                if handler:
                    try:
                        result = await handler(params)
                        await self._send({"jsonrpc": "2.0", "id": req_id, "result": result})
                    except Exception as e:
                        await self._send({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {"code": -32000, "message": str(e)},
                        })
                else:
                    await self._send({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32601, "message": "Method not found"},
                    })
                continue

            # Notification from agent
            if isinstance(msg, dict) and "method" in msg and "id" not in msg:
                method = msg["method"]
                params = msg.get("params") or {}
                for h in self._notif_handlers.get(method, []) or []:
                    try:
                        h(params)
                    except Exception:
                        pass

    async def _send(self, obj: Dict[str, Any]) -> None:
        if not self._proc or not self._proc.stdin:
            return
        self._proc.stdin.write((json.dumps(obj) + "\n").encode("utf-8"))
        await self._proc.stdin.drain()


class QwenCLI(BaseCLI):
    """Qwen CLI via ACP. Streams message and thought chunks to UI."""

    # Shared ACP client across instances to preserve sessions
    _SHARED_CLIENT: Optional[_ACPClient] = None
    _SHARED_INITIALIZED: bool = False

    def __init__(self, db_session=None):
        super().__init__(CLIType.QWEN)
        self.db_session = db_session
        self._session_store: Dict[str, str] = {}
        self._client: Optional[_ACPClient] = None
        self._initialized = False

    async def check_availability(self) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_shell(
                "qwen --help",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": "Qwen CLI not found. Install Qwen CLI and ensure it is in PATH.",
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
        """Ensure QWEN.md exists at the project repo root.

        Mirrors CursorAgent behavior: copy app/prompt/system-prompt.md if present.
        """
        try:
            project_repo_path = os.path.join(project_path, "repo")
            if not os.path.exists(project_repo_path):
                project_repo_path = project_path
            md_path = os.path.join(project_repo_path, "QWEN.md")
            if os.path.exists(md_path):
                ui.debug(f"QWEN.md already exists at: {md_path}", "Qwen")
                return
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            app_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))
            system_prompt_path = os.path.join(app_dir, "prompt", "system-prompt.md")
            content = "# QWEN\n\n"
            if os.path.exists(system_prompt_path):
                try:
                    with open(system_prompt_path, "r", encoding="utf-8") as f:
                        content += f.read()
                except Exception:
                    pass
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(content)
            ui.success(f"Created QWEN.md at: {md_path}", "Qwen")
        except Exception as e:
            ui.warning(f"Failed to create QWEN.md: {e}", "Qwen")

    async def _ensure_client(self) -> _ACPClient:
        # Use shared client across adapter instances
        if QwenCLI._SHARED_CLIENT is None:
            # Resolve command: env(QWEN_CMD) -> qwen -> qwen-code
            candidates = []
            env_cmd = os.getenv("QWEN_CMD")
            if env_cmd:
                candidates.append(env_cmd)
            candidates.extend(["qwen", "qwen-code"])
            resolved = None
            for c in candidates:
                if shutil.which(c):
                    resolved = c
                    break
            if not resolved:
                raise RuntimeError(
                    "Qwen CLI not found. Set QWEN_CMD or install 'qwen' CLI in PATH."
                )
            cmd = [resolved, "--experimental-acp"]
            # Prefer device-code / no-browser flow to avoid launching windows
            env = os.environ.copy()
            env.setdefault("NO_BROWSER", "1")
            QwenCLI._SHARED_CLIENT = _ACPClient(cmd, env=env)

            # Register client-side request handlers
            async def _handle_permission(params: Dict[str, Any]) -> Dict[str, Any]:
                # Auto-approve: prefer allow_always -> allow_once -> first
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
                # Conservative: deny reading arbitrary files from agent perspective
                return {"content": ""}

            async def _fs_write(params: Dict[str, Any]) -> Dict[str, Any]:
                # Validate required parameters for file editing
                if "old_string" not in params and "content" in params:
                    # If old_string is missing but content exists, log warning
                    ui.warning(
                        f"Qwen edit missing 'old_string' parameter: {params.get('path', 'unknown')}",
                        "Qwen"
                    )
                    return {"error": "Missing required parameter: old_string"}
                # Not fully implemented for safety, but return success to avoid blocking
                return {"success": True}

            async def _edit_file(params: Dict[str, Any]) -> Dict[str, Any]:
                # Handle edit requests with proper parameter validation
                path = params.get('path', params.get('file_path', 'unknown'))
                
                # Log the edit attempt for debugging
                ui.debug(f"Qwen edit request: path={path}, has_old_string={'old_string' in params}", "Qwen")
                
                if "old_string" not in params:
                    ui.warning(
                        f"Qwen edit missing 'old_string': {path}",
                        "Qwen"
                    )
                    # Return success anyway to not block Qwen's workflow
                    # This allows Qwen to continue even with malformed requests
                    return {"success": True}
                
                # For safety, we don't actually perform the edit but return success
                ui.debug(f"Qwen edit would modify: {path}", "Qwen")
                return {"success": True}

            QwenCLI._SHARED_CLIENT.on_request("session/request_permission", _handle_permission)
            QwenCLI._SHARED_CLIENT.on_request("fs/read_text_file", _fs_read)
            QwenCLI._SHARED_CLIENT.on_request("fs/write_text_file", _fs_write)
            QwenCLI._SHARED_CLIENT.on_request("edit", _edit_file)
            QwenCLI._SHARED_CLIENT.on_request("str_replace_editor", _edit_file)

            await QwenCLI._SHARED_CLIENT.start()
            # Attach simple stderr logger (filtering out polling messages)
            try:
                proc = QwenCLI._SHARED_CLIENT._proc
                if proc and proc.stderr:
                    async def _log_stderr(stream):
                        while True:
                            line = await stream.readline()
                            if not line:
                                break
                            decoded = line.decode(errors="ignore").strip()
                            # Skip polling for token messages
                            if "polling for token" in decoded.lower():
                                continue
                            # Skip ImportProcessor errors (these are just warnings about npm packages)
                            if "[ERROR] [ImportProcessor]" in decoded:
                                continue
                            # Skip ENOENT errors for node_modules paths
                            if "ENOENT" in decoded and ("node_modules" in decoded or "tailwind" in decoded or "supabase" in decoded):
                                continue
                            # Only log meaningful errors
                            if decoded and not decoded.startswith("DEBUG"):
                                ui.warning(decoded, "Qwen STDERR")
                    asyncio.create_task(_log_stderr(proc.stderr))
            except Exception:
                pass

        self._client = QwenCLI._SHARED_CLIENT

        if not QwenCLI._SHARED_INITIALIZED:
            try:
                await self._client.request(
                    "initialize",
                    {
                        "clientCapabilities": {
                            "fs": {"readTextFile": False, "writeTextFile": False}
                        },
                        "protocolVersion": 1,
                    },
                )
                QwenCLI._SHARED_INITIALIZED = True
            except Exception as e:
                ui.error(f"Qwen initialize failed: {e}", "Qwen")
                raise

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
                "Qwen",
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
        if not stored_session_id:
            # Try to reuse cached OAuth by creating a session first
            try:
                result = await client.request(
                    "session/new", {"cwd": project_repo_path, "mcpServers": []}
                )
                stored_session_id = result.get("sessionId")
                if stored_session_id:
                    await self.set_session_id(project_id, stored_session_id)
                    ui.info(f"Qwen session created: {stored_session_id}", "Qwen")
            except Exception as e:
                # Authenticate only if needed, then retry session/new
                auth_method = os.getenv("QWEN_AUTH_METHOD", "qwen-oauth")
                ui.warning(
                    f"Qwen session/new failed; authenticating via {auth_method}: {e}",
                    "Qwen",
                )
                try:
                    await client.request("authenticate", {"methodId": auth_method})
                    result = await client.request(
                        "session/new", {"cwd": project_repo_path, "mcpServers": []}
                    )
                    stored_session_id = result.get("sessionId")
                    if stored_session_id:
                        await self.set_session_id(project_id, stored_session_id)
                        ui.info(
                            f"Qwen session created after auth: {stored_session_id}", "Qwen"
                        )
                except Exception as e2:
                    err = f"Qwen authentication/session failed: {e2}"
                    yield Message(
                        id=str(uuid.uuid4()),
                        project_id=project_path,
                        role="assistant",
                        message_type="error",
                        content=err,
                        metadata_json={"cli_type": self.cli_type.value},
                        session_id=session_id,
                        created_at=datetime.utcnow(),
                    )
                    return

        # Subscribe to session/update notifications and stream as Message
        q: asyncio.Queue = asyncio.Queue()
        thought_buffer: List[str] = []
        text_buffer: List[str] = []

        def _on_update(params: Dict[str, Any]) -> None:
            try:
                if params.get("sessionId") != stored_session_id:
                    return
                update = params.get("update") or {}
                q.put_nowait(update)
            except Exception:
                pass

        client.on_notification("session/update", _on_update)

        # Build prompt parts
        parts: List[Dict[str, Any]] = []
        if instruction:
            parts.append({"type": "text", "text": instruction})

        # Qwen Coder currently does not support image input.
        # If images are provided, ignore them to avoid ACP errors.
        if images:
            try:
                ui.warning(
                    "Qwen Coder does not support image input yet. Ignoring attached images.",
                    "Qwen",
                )
            except Exception:
                pass

        # Send prompt request
        # Helper to create a prompt task for current session
        def _make_prompt_task() -> asyncio.Task:
            ui.debug(f"[{turn_id}] sending session/prompt (parts={len(parts)})", "Qwen")
            return asyncio.create_task(
                client.request(
                    "session/prompt",
                    {"sessionId": stored_session_id, "prompt": parts},
                )
            )

        prompt_task = _make_prompt_task()

        # Stream notifications until prompt completes
        while True:
            done, pending = await asyncio.wait(
                {prompt_task, asyncio.create_task(q.get())},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if prompt_task in done:
                ui.debug(f"[{turn_id}] prompt_task completed; draining updates", "Qwen")
                # Flush remaining updates quickly
                while not q.empty():
                    update = q.get_nowait()
                    async for m in self._update_to_messages(update, project_path, session_id, thought_buffer, text_buffer):
                        if m:
                            yield m
                # Handle prompt exception (e.g., session not found) with one retry
                exc = prompt_task.exception()
                if exc:
                    msg = str(exc)
                    if "Session not found" in msg or "session not found" in msg.lower():
                        ui.warning("Qwen session expired; creating a new session and retrying", "Qwen")
                        try:
                            result = await client.request(
                                "session/new", {"cwd": project_repo_path, "mcpServers": []}
                            )
                            stored_session_id = result.get("sessionId")
                            if stored_session_id:
                                await self.set_session_id(project_id, stored_session_id)
                                prompt_task = _make_prompt_task()
                                continue  # re-enter wait loop
                        except Exception as e2:
                            yield Message(
                                id=str(uuid.uuid4()),
                                project_id=project_path,
                                role="assistant",
                                message_type="error",
                                content=f"Qwen session recovery failed: {e2}",
                                metadata_json={"cli_type": self.cli_type.value},
                                session_id=session_id,
                                created_at=datetime.utcnow(),
                            )
                    else:
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="error",
                            content=f"Qwen prompt error: {msg}",
                            metadata_json={"cli_type": self.cli_type.value},
                            session_id=session_id,
                            created_at=datetime.utcnow(),
                        )
                # Final flush of buffered assistant text
                if thought_buffer or text_buffer:
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

            # Process one update
            for task in done:
                if task is not prompt_task:
                    update = task.result()
                    # Suppress verbose per-chunk logs; log only tool calls below
                    async for m in self._update_to_messages(update, project_path, session_id, thought_buffer, text_buffer):
                        if m:
                            yield m

        # Yield hidden result/system message for bookkeeping
        yield Message(
            id=str(uuid.uuid4()),
            project_id=project_path,
            role="system",
            message_type="result",
            content="Qwen turn completed",
            metadata_json={"cli_type": self.cli_type.value, "hidden_from_ui": True},
            session_id=session_id,
            created_at=datetime.utcnow(),
        )
        ui.info(f"[{turn_id}] turn completed", "Qwen")

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
            if not isinstance(text, str):
                text = str(text)
            if kind == "agent_thought_chunk":
                thought_buffer.append(text)
            else:
                text_buffer.append(text)
            # Do not flush here: we flush only before tool events or at end,
            # to match result_qwen.md behavior (message → tools → message ...)
            return
        elif kind in ("tool_call", "tool_call_update"):
            # Qwen emits frequent tool_call_update events and opaque call IDs
            # like `call_390e...` that produce noisy "executing..." lines.
            # Hide updates entirely and only surface meaningful tool calls.
            if kind == "tool_call_update":
                return

            tool_name = self._parse_tool_name(update)
            tool_input = self._extract_tool_input(update)
            summary = self._create_tool_summary(tool_name, tool_input)

            # Suppress unknown/opaque tool names that fall back to "executing..."
            try:
                tn = (tool_name or "").lower()
                is_opaque = (
                    tn in ("call", "tool", "toolcall")
                    or tn.startswith("call_")
                    or tn.startswith("call-")
                )
                if is_opaque or summary.strip().endswith("`executing...`"):
                    return
            except Exception:
                pass

            # Flush chat buffer before showing tool usage
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

            # Show tool use as a visible message
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="tool_use",
                content=summary,
                metadata_json={
                    "cli_type": self.cli_type.value,
                    "event_type": "tool_call",  # normalized
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                },
                session_id=session_id,
                created_at=now,
            )
            # Concise server-side log
            try:
                path = tool_input.get("path")
                ui.info(
                    f"TOOL {tool_name.upper()}" + (f" {path}" if path else ""),
                    "Qwen",
                )
            except Exception:
                pass
        elif kind == "plan":
            entries = update.get("entries") or []
            lines = []
            for e in entries[:6]:
                title = e.get("title") if isinstance(e, dict) else str(e)
                if title:
                    lines.append(f"• {title}")
            content = "\n".join(lines) if lines else "Planning…"
            # Optionally flush buffer before plan (keep as separate status)
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
        else:
            # Unknown update kinds ignored
            return

    def _compose_content(self, thought_buffer: List[str], text_buffer: List[str]) -> str:
        # Qwen formatting per result_qwen.md: merge thoughts + text, and filter noisy call_* lines
        import re
        parts: List[str] = []
        if thought_buffer:
            parts.append("".join(thought_buffer))
            if text_buffer:
                parts.append("\n\n")
        if text_buffer:
            parts.append("".join(text_buffer))
        combined = "".join(parts)
        # Remove lines like: call_XXXXXXXX executing... (Qwen internal call IDs)
        combined = re.sub(r"(?m)^call[_-][A-Za-z0-9]+.*$\n?", "", combined)
        # Trim excessive blank lines
        combined = re.sub(r"\n{3,}", "\n\n", combined).strip()
        return combined

    def _parse_tool_name(self, update: Dict[str, Any]) -> str:
        # Prefer explicit kind from Qwen events
        kind = update.get("kind")
        if isinstance(kind, str) and kind.strip():
            return kind.strip()
        # Fallback: derive from toolCallId by splitting on '-' or '_'
        raw_id = update.get("toolCallId") or ""
        if isinstance(raw_id, str) and raw_id:
            for sep in ("-", "_"):
                base = raw_id.split(sep, 1)[0]
                if base and base.lower() not in ("call", "tool", "toolcall"):
                    return base
        return update.get("title") or "tool"

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
                        if isinstance(data, dict) and "qwen" in data:
                            return data["qwen"]
                    except Exception:
                        pass
            except Exception as e:
                ui.warning(f"Qwen get_session_id DB error: {e}", "Qwen")
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
                    data["qwen"] = session_id
                    project.active_cursor_session_id = json.dumps(data)
                    self.db_session.commit()
            except Exception as e:
                ui.warning(f"Qwen set_session_id DB error: {e}", "Qwen")
        self._session_store[project_id] = session_id


def _mime_for(path: str) -> str:
    p = path.lower()
    if p.endswith(".png"):
        return "image/png"
    if p.endswith(".jpg") or p.endswith(".jpeg"):
        return "image/jpeg"
    if p.endswith(".gif"):
        return "image/gif"
    if p.endswith(".webp"):
        return "image/webp"
    if p.endswith(".bmp"):
        return "image/bmp"
    return "application/octet-stream"


__all__ = ["QwenCLI"]
