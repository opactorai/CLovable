"""Cursor Agent provider implementation.

Moved from unified_manager.py to a dedicated adapter module.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from app.models.messages import Message
from app.core.terminal_ui import ui

from ..base import BaseCLI, CLIType


class CursorAgentCLI(BaseCLI):
    """Cursor Agent CLI implementation with stream-json support and session continuity"""

    def __init__(self, db_session=None):
        super().__init__(CLIType.CURSOR)
        self.db_session = db_session
        self._session_store = {}  # Fallback for when db_session is not available

    async def check_availability(self) -> Dict[str, Any]:
        """Check if Cursor Agent CLI is available"""
        try:
            # Check if cursor-agent is installed and working
            result = await asyncio.create_subprocess_shell(
                "cursor-agent -h",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": (
                        "Cursor Agent CLI not installed or not working.\n\nTo install:\n"
                        "1. Install Cursor: curl https://cursor.com/install -fsS | bash\n"
                        "2. Login to Cursor: cursor-agent login\n3. Try running your prompt again"
                    ),
                }

            # Check if help output contains expected content
            help_output = stdout.decode() + stderr.decode()
            if "cursor-agent" not in help_output.lower():
                return {
                    "available": False,
                    "configured": False,
                    "error": (
                        "Cursor Agent CLI not responding correctly.\n\nPlease try:\n"
                        "1. Reinstall: curl https://cursor.com/install -fsS | bash\n"
                        "2. Login: cursor-agent login\n3. Check installation: cursor-agent -h"
                    ),
                }

            return {
                "available": True,
                "configured": True,
                "models": self.get_supported_models(),
                "default_models": ["gpt-5", "sonnet-4"],
            }
        except Exception as e:
            return {
                "available": False,
                "configured": False,
                "error": (
                    f"Failed to check Cursor Agent: {str(e)}\n\nTo install:\n"
                    "1. Install Cursor: curl https://cursor.com/install -fsS | bash\n"
                    "2. Login: cursor-agent login"
                ),
            }

    def _handle_cursor_stream_json(
        self, event: Dict[str, Any], project_path: str, session_id: str
    ) -> Optional[Message]:
        """Handle Cursor stream-json format (NDJSON events) to be compatible with Claude Code CLI output"""
        event_type = event.get("type")

        if event_type == "system":
            # System initialization event
            return Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="system",
                message_type="system",
                content=f"🔧 Cursor Agent initialized (Model: {event.get('model', 'unknown')})",
                metadata_json={
                    "cli_type": self.cli_type.value,
                    "event_type": "system",
                    "cwd": event.get("cwd"),
                    "api_key_source": event.get("apiKeySource"),
                    "original_event": event,
                    "hidden_from_ui": True,  # Hide system init messages
                },
                session_id=session_id,
                created_at=datetime.utcnow(),
            )

        elif event_type == "user":
            # Cursor echoes back the user's prompt. Suppress it to avoid duplicates.
            return None

        elif event_type == "assistant":
            # Assistant response event (text delta)
            message_content = event.get("message", {}).get("content", [])
            content = ""

            if message_content and isinstance(message_content, list):
                for part in message_content:
                    if part.get("type") == "text":
                        content += part.get("text", "")

            if content:
                return Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=content,
                    metadata_json={
                        "cli_type": self.cli_type.value,
                        "event_type": "assistant",
                        "original_event": event,
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow(),
                )

        elif event_type == "tool_call":
            subtype = event.get("subtype")
            tool_call_data = event.get("tool_call", {})
            if not tool_call_data:
                return None

            tool_name_raw = next(iter(tool_call_data), None)
            if not tool_name_raw:
                return None

            # Normalize tool name: lsToolCall -> ls
            tool_name = tool_name_raw.replace("ToolCall", "")

            if subtype == "started":
                tool_input = tool_call_data[tool_name_raw].get("args", {})
                summary = self._create_tool_summary(tool_name, tool_input)

                return Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=summary,
                    metadata_json={
                        "cli_type": self.cli_type.value,
                        "event_type": "tool_call_started",
                        "tool_name": tool_name,
                        "tool_input": tool_input,
                        "original_event": event,
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow(),
                )

            elif subtype == "completed":
                result = tool_call_data[tool_name_raw].get("result", {})
                content = ""
                if "success" in result:
                    content = json.dumps(result["success"])
                elif "error" in result:
                    content = json.dumps(result["error"])

                return Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="system",
                    message_type="tool_result",
                    content=content,
                    metadata_json={
                        "cli_type": self.cli_type.value,
                        "original_format": event,
                        "tool_name": tool_name,
                        "hidden_from_ui": True,
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow(),
                )

        elif event_type == "result":
            # Final result event
            duration = event.get("duration_ms", 0)
            result_text = event.get("result", "")

            if result_text:
                return Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="system",
                    message_type="system",
                    content=(
                        f"Execution completed in {duration}ms. Final result: {result_text}"
                    ),
                    metadata_json={
                        "cli_type": self.cli_type.value,
                        "event_type": "result",
                        "duration_ms": duration,
                        "original_event": event,
                        "hidden_from_ui": True,
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow(),
                )

        return None

    async def _ensure_agent_md(self, project_path: str) -> None:
        """Ensure AGENTS.md exists in project repo with system prompt"""
        # Determine the repo path
        project_repo_path = os.path.join(project_path, "repo")
        if not os.path.exists(project_repo_path):
            project_repo_path = project_path

        agent_md_path = os.path.join(project_repo_path, "AGENTS.md")

        # Check if AGENTS.md already exists
        if os.path.exists(agent_md_path):
            print(f"📝 [Cursor] AGENTS.md already exists at: {agent_md_path}")
            return

        try:
            # Read system prompt from the source file using relative path
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            # this file is in: app/services/cli/adapters/
            # go up to app/: adapters -> cli -> services -> app
            app_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))
            system_prompt_path = os.path.join(app_dir, "prompt", "system-prompt.md")

            if os.path.exists(system_prompt_path):
                with open(system_prompt_path, "r", encoding="utf-8") as f:
                    system_prompt_content = f.read()

                # Write to AGENTS.md in the project repo
                with open(agent_md_path, "w", encoding="utf-8") as f:
                    f.write(system_prompt_content)

                print(f"📝 [Cursor] Created AGENTS.md at: {agent_md_path}")
            else:
                print(
                    f"⚠️ [Cursor] System prompt file not found at: {system_prompt_path}"
                )
        except Exception as e:
            print(f"❌ [Cursor] Failed to create AGENTS.md: {e}")

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
        """Execute Cursor Agent CLI with stream-json format and session continuity"""
        # Ensure AGENTS.md exists for system prompt
        await self._ensure_agent_md(project_path)

        # Extract project ID from path (format: .../projects/{project_id}/repo)
        # We need the project_id, not "repo"
        path_parts = project_path.split("/")
        if "repo" in path_parts and len(path_parts) >= 2:
            # Get the folder before "repo"
            repo_index = path_parts.index("repo")
            if repo_index > 0:
                project_id = path_parts[repo_index - 1]
            else:
                project_id = path_parts[-1] if path_parts else project_path
        else:
            project_id = path_parts[-1] if path_parts else project_path

        stored_session_id = await self.get_session_id(project_id)

        cmd = [
            "cursor-agent",
            "--force",
            "-p",
            instruction,
            "--output-format",
            "stream-json",  # Use stream-json format
        ]

        # Add session resume if available (prefer stored session over parameter)
        active_session_id = stored_session_id or session_id
        if active_session_id:
            cmd.extend(["--resume", active_session_id])
            print(f"🔗 [Cursor] Resuming session: {active_session_id}")

        # Add API key if available
        if os.getenv("CURSOR_API_KEY"):
            cmd.extend(["--api-key", os.getenv("CURSOR_API_KEY")])

        # Add model - prioritize parameter over environment variable
        cli_model = self._get_cli_model_name(model) or os.getenv("CURSOR_MODEL")
        if cli_model:
            cmd.extend(["-m", cli_model])
            print(f"🔧 [Cursor] Using model: {cli_model}")

        project_repo_path = os.path.join(project_path, "repo")
        if not os.path.exists(project_repo_path):
            project_repo_path = project_path  # Fallback to project_path if repo subdir doesn't exist

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_repo_path,
            )

            cursor_session_id = None
            assistant_message_buffer = ""
            result_received = False  # Track if we received result event

            async for line in process.stdout:
                line_str = line.decode().strip()
                if not line_str:
                    continue

                try:
                    # Parse NDJSON event
                    event = json.loads(line_str)

                    event_type = event.get("type")

                    # Priority: Extract session ID from type: "result" event (most reliable)
                    if event_type == "result" and not cursor_session_id:
                        print(f"🔍 [Cursor] Result event received: {event}")
                        session_id_from_result = event.get("session_id")
                        if session_id_from_result:
                            cursor_session_id = session_id_from_result
                            await self.set_session_id(project_id, cursor_session_id)
                            print(
                                f"💾 [Cursor] Session ID extracted from result event: {cursor_session_id}"
                            )

                        # Mark that we received result event
                        result_received = True

                    # Extract session ID from various event types
                    if not cursor_session_id:
                        # Try to extract session ID from any event that contains it
                        potential_session_id = (
                            event.get("sessionId")
                            or event.get("chatId")
                            or event.get("session_id")
                            or event.get("chat_id")
                            or event.get("threadId")
                            or event.get("thread_id")
                        )

                        # Also check in nested structures
                        if not potential_session_id and isinstance(
                            event.get("message"), dict
                        ):
                            potential_session_id = (
                                event["message"].get("sessionId")
                                or event["message"].get("chatId")
                                or event["message"].get("session_id")
                                or event["message"].get("chat_id")
                            )

                        if potential_session_id and potential_session_id != active_session_id:
                            cursor_session_id = potential_session_id
                            await self.set_session_id(project_id, cursor_session_id)
                            print(
                                f"💾 [Cursor] Updated session ID for project {project_id}: {cursor_session_id}"
                            )
                            print(f"   Previous: {active_session_id}")
                            print(f"   New: {cursor_session_id}")

                    # If we receive a non-assistant message, flush the buffer first
                    if event.get("type") != "assistant" and assistant_message_buffer:
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="chat",
                            content=assistant_message_buffer,
                            metadata_json={
                                "cli_type": "cursor",
                                "event_type": "assistant_aggregated",
                            },
                            session_id=session_id,
                            created_at=datetime.utcnow(),
                        )
                        assistant_message_buffer = ""

                    # Process the event
                    message = self._handle_cursor_stream_json(
                        event, project_path, session_id
                    )

                    if message:
                        if message.role == "assistant" and message.message_type == "chat":
                            assistant_message_buffer += message.content
                        else:
                            if log_callback:
                                await log_callback(f"📝 [Cursor] {message.content}")
                            yield message

                    # ★ CRITICAL: Break after result event to end streaming
                    if result_received:
                        print(
                            f"🏁 [Cursor] Result event received, terminating stream early"
                        )
                        try:
                            process.terminate()
                            print(f"🔪 [Cursor] Process terminated")
                        except Exception as e:
                            print(f"⚠️ [Cursor] Failed to terminate process: {e}")
                        break

                except json.JSONDecodeError as e:
                    # Handle malformed JSON
                    print(f"⚠️ [Cursor] JSON decode error: {e}")
                    print(f"⚠️ [Cursor] Raw line: {line_str}")

                    # Still yield as raw output
                    message = Message(
                        id=str(uuid.uuid4()),
                        project_id=project_path,
                        role="assistant",
                        message_type="chat",
                        content=line_str,
                        metadata_json={
                            "cli_type": "cursor",
                            "raw_output": line_str,
                            "parse_error": str(e),
                        },
                        session_id=session_id,
                        created_at=datetime.utcnow(),
                    )
                    yield message

            # Flush any remaining content in the buffer
            if assistant_message_buffer:
                yield Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=assistant_message_buffer,
                    metadata_json={
                        "cli_type": "cursor",
                        "event_type": "assistant_aggregated",
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow(),
                )

            await process.wait()

            # Log completion
            if cursor_session_id:
                print(f"✅ [Cursor] Session completed: {cursor_session_id}")

        except FileNotFoundError:
            error_msg = (
                "❌ Cursor Agent CLI not found. Please install with: curl https://cursor.com/install -fsS | bash"
            )
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content=error_msg,
                metadata_json={"error": "cli_not_found", "cli_type": "cursor"},
                session_id=session_id,
                created_at=datetime.utcnow(),
            )
        except Exception as e:
            error_msg = f"❌ Cursor Agent execution failed: {str(e)}"
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content=error_msg,
                metadata_json={
                    "error": "execution_failed",
                    "cli_type": "cursor",
                    "exception": str(e),
                },
                session_id=session_id,
                created_at=datetime.utcnow(),
            )

    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Get stored session ID for project to enable session continuity"""
        if self.db_session:
            try:
                from app.models.projects import Project

                project = (
                    self.db_session.query(Project)
                    .filter(Project.id == project_id)
                    .first()
                )
                if project and project.active_cursor_session_id:
                    print(
                        f"💾 [Cursor] Retrieved session ID from DB: {project.active_cursor_session_id}"
                    )
                    return project.active_cursor_session_id
            except Exception as e:
                print(f"⚠️ [Cursor] Failed to get session ID from DB: {e}")

        # Fallback to in-memory storage
        return self._session_store.get(project_id)

    async def set_session_id(self, project_id: str, session_id: str) -> None:
        """Store session ID for project to enable session continuity"""
        # Store in database if available
        if self.db_session:
            try:
                from app.models.projects import Project

                project = (
                    self.db_session.query(Project)
                    .filter(Project.id == project_id)
                    .first()
                )
                if project:
                    project.active_cursor_session_id = session_id
                    self.db_session.commit()
                    print(
                        f"💾 [Cursor] Session ID saved to DB for project {project_id}: {session_id}"
                    )
                    return
                else:
                    print(f"⚠️ [Cursor] Project {project_id} not found in DB")
            except Exception as e:
                print(f"⚠️ [Cursor] Failed to save session ID to DB: {e}")
                import traceback

                traceback.print_exc()
        else:
            print(f"⚠️ [Cursor] No DB session available")

        # Fallback to in-memory storage
        self._session_store[project_id] = session_id
        print(
            f"💾 [Cursor] Session ID stored in memory for project {project_id}: {session_id}"
        )


__all__ = ["CursorAgentCLI"]
