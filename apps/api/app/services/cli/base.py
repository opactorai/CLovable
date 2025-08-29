"""
Base abstractions and shared utilities for CLI providers.

This module defines a precise, minimal adapter contract (BaseCLI) and common
helpers so that adding a new provider remains consistent and easy.
"""
from __future__ import annotations

import os
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from app.models.messages import Message


def get_project_root() -> str:
    """Return project root directory using relative path navigation.

    This function intentionally mirrors the logic previously embedded in
    unified_manager.py so imports remain stable after refactor.
    """
    current_file_dir = os.path.dirname(os.path.abspath(__file__))
    # base.py is in: app/services/cli/
    # Navigate: cli -> services -> app -> api -> apps -> project-root
    project_root = os.path.join(current_file_dir, "..", "..", "..", "..", "..")
    return os.path.abspath(project_root)


def get_display_path(file_path: str) -> str:
    """Convert absolute path to a shorter display path scoped to the project.

    - Strips the project root prefix when present
    - Compacts repo-specific prefixes (e.g., data/projects -> …/)
    """
    try:
        project_root = get_project_root()
        if file_path.startswith(project_root):
            display_path = file_path.replace(project_root + "/", "")
            return display_path.replace("data/projects/", "…/")
    except Exception:
        pass
    return file_path


# Model mapping from unified names to CLI-specific names
MODEL_MAPPING: Dict[str, Dict[str, str]] = {
    "claude": {
        "opus-4.1": "claude-opus-4-1-20250805",
        "sonnet-4": "claude-sonnet-4-20250514",
        "opus-4": "claude-opus-4-20250514",
        "haiku-3.5": "claude-3-5-haiku-20241022",
        # Handle claude-prefixed model names
        "claude-sonnet-4": "claude-sonnet-4-20250514",
        "claude-opus-4.1": "claude-opus-4-1-20250805",
        "claude-opus-4": "claude-opus-4-20250514",
        "claude-haiku-3.5": "claude-3-5-haiku-20241022",
        # Support direct full model names
        "claude-opus-4-1-20250805": "claude-opus-4-1-20250805",
        "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
        "claude-opus-4-20250514": "claude-opus-4-20250514",
        "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
    },
    "cursor": {
        "gpt-5": "gpt-5",
        "sonnet-4": "sonnet-4",
        "opus-4.1": "opus-4.1",
        "sonnet-4-thinking": "sonnet-4-thinking",
        # Handle mapping from unified Claude model names
        "claude-sonnet-4": "sonnet-4",
        "claude-opus-4.1": "opus-4.1",
        "claude-sonnet-4-20250514": "sonnet-4",
        "claude-opus-4-1-20250805": "opus-4.1",
    },
    "codex": {
        "gpt-5": "gpt-5",
        "gpt-4o": "gpt-4o",
        "gpt-4o-mini": "gpt-4o-mini",
        "o1-preview": "o1-preview",
        "o1-mini": "o1-mini",
        "claude-3.5-sonnet": "claude-3.5-sonnet",
        "claude-3-haiku": "claude-3-haiku",
        # Handle unified model names
        "sonnet-4": "claude-3.5-sonnet",
        "claude-sonnet-4": "claude-3.5-sonnet",
        "haiku-3.5": "claude-3-haiku",
        "claude-haiku-3.5": "claude-3-haiku",
    },
    "qwen": {
        # Unified name → provider mapping
        "qwen3-coder-plus": "qwen-coder",
        "Qwen3 Coder Plus": "qwen-coder",
        # Allow direct
        "qwen-coder": "qwen-coder",
    },
    "gemini": {
        "gemini-2.5-pro": "gemini-2.5-pro",
        "gemini-2.5-flash": "gemini-2.5-flash",
    },
}


class CLIType(str, Enum):
    """Provider key used across the manager and adapters."""

    CLAUDE = "claude"
    CURSOR = "cursor"
    CODEX = "codex"
    QWEN = "qwen"
    GEMINI = "gemini"


class BaseCLI(ABC):
    """Abstract adapter contract for CLI providers.

    Subclasses must implement availability checks, streaming execution, and
    session persistence. Common utilities (model mapping, content parsing,
    tool summaries) are provided here for reuse.
    """

    def __init__(self, cli_type: CLIType):
        self.cli_type = cli_type

    # ---- Mandatory adapter interface ------------------------------------
    @abstractmethod
    async def check_availability(self) -> Dict[str, Any]:
        """Return provider availability/configuration status.

        Expected keys in the returned dict used by the manager:
        - available: bool
        - configured: bool
        - models/default_models (optional): List[str]
        - error (optional): str
        """

    @abstractmethod
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
        """Execute an instruction and yield `Message` objects in real time."""

    @abstractmethod
    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Return the active session ID for a project, if any."""

    @abstractmethod
    async def set_session_id(self, project_id: str, session_id: str) -> None:
        """Persist the active session ID for a project."""

    # ---- Common helpers (available to adapters) --------------------------
    def _get_cli_model_name(self, model: Optional[str]) -> Optional[str]:
        """Translate unified model name to provider-specific model name.

        If the input is already a provider name or mapping fails, return as-is.
        """
        if not model:
            return None

        from app.core.terminal_ui import ui

        ui.debug(f"Input model: '{model}' for CLI: {self.cli_type.value}", "Model")
        cli_models = MODEL_MAPPING.get(self.cli_type.value, {})

        # Try exact mapping
        if model in cli_models:
            mapped_model = cli_models[model]
            ui.info(
                f"Mapped '{model}' to '{mapped_model}' for {self.cli_type.value}", "Model"
            )
            return mapped_model

        # Already a provider-specific name
        if model in cli_models.values():
            ui.info(
                f"Using direct model name '{model}' for {self.cli_type.value}", "Model"
            )
            return model

        # Debug available models
        available_models = list(cli_models.keys())
        ui.warning(
            f"Model '{model}' not found in mapping for {self.cli_type.value}", "Model"
        )
        ui.debug(
            f"Available models for {self.cli_type.value}: {available_models}", "Model"
        )
        ui.warning(f"Using model as-is: '{model}'", "Model")
        return model

    def get_supported_models(self) -> List[str]:
        cli_models = MODEL_MAPPING.get(self.cli_type.value, {})
        return list(cli_models.keys()) + list(cli_models.values())

    def is_model_supported(self, model: str) -> bool:
        return (
            model in self.get_supported_models()
            or model in MODEL_MAPPING.get(self.cli_type.value, {}).values()
        )

    def parse_message_data(self, data: Dict[str, Any], project_id: str, session_id: str) -> Message:
        """Normalize provider-specific message payload to our `Message`."""
        return Message(
            id=str(uuid.uuid4()),
            project_id=project_id,
            role=self._normalize_role(data.get("role", "assistant")),
            message_type="chat",
            content=self._extract_content(data),
            metadata_json={
                **data,
                "cli_type": self.cli_type.value,
                "original_format": data,
            },
            session_id=session_id,
            created_at=datetime.utcnow(),
        )

    def _normalize_role(self, role: str) -> str:
        role_mapping = {
            "model": "assistant",
            "ai": "assistant",
            "human": "user",
            "bot": "assistant",
        }
        return role_mapping.get(role.lower(), role.lower())

    def _extract_content(self, data: Dict[str, Any]) -> str:
        """Extract best-effort text content from various provider formats."""
        # Claude content array
        if "content" in data and isinstance(data["content"], list):
            content = ""
            for item in data["content"]:
                if item.get("type") == "text":
                    content += item.get("text", "")
                elif item.get("type") == "tool_use":
                    tool_name = item.get("name", "Unknown")
                    tool_input = item.get("input", {})
                    summary = self._create_tool_summary(tool_name, tool_input)
                    content += f"{summary}\n"
            return content

        # Simple text
        elif "content" in data:
            return str(data["content"])

        # Gemini parts
        elif "parts" in data:
            content = ""
            for part in data["parts"]:
                if "text" in part:
                    content += part.get("text", "")
                elif "functionCall" in part:
                    func_call = part["functionCall"]
                    tool_name = func_call.get("name", "Unknown")
                    tool_input = func_call.get("args", {})
                    summary = self._create_tool_summary(tool_name, tool_input)
                    content += f"{summary}\n"
            return content

        # OpenAI/Codex choices
        elif "choices" in data and data["choices"]:
            choice = data["choices"][0]
            if "message" in choice:
                return choice["message"].get("content", "")
            elif "text" in choice:
                return choice.get("text", "")

        # Direct text fields
        elif "text" in data:
            return str(data["text"])
        elif "message" in data:
            if isinstance(data["message"], dict):
                return self._extract_content(data["message"])
            return str(data["message"])

        # Generic response field
        elif "response" in data:
            return str(data["response"])

        # Delta streaming
        elif "delta" in data and "content" in data["delta"]:
            return str(data["delta"]["content"])

        # Fallback
        else:
            return str(data)

    def _normalize_tool_name(self, tool_name: str) -> str:
        """Normalize tool names across providers to a unified label."""
        key = (tool_name or "").strip()
        key_lower = key.replace(" ", "").lower()
        tool_mapping = {
            # File operations
            "read_file": "Read",
            "read": "Read",
            "write_file": "Write",
            "write": "Write",
            "edit_file": "Edit",
            "replace": "Edit",
            "edit": "Edit",
            "delete": "Delete",
            # Qwen/Gemini variants (CamelCase / spaced)
            "readfile": "Read",
            "readfolder": "LS",
            "readmanyfiles": "Read",
            "writefile": "Write",
            "findfiles": "Glob",
            "savememory": "SaveMemory",
            "save memory": "SaveMemory",
            "searchtext": "Grep",
            # Terminal operations
            "shell": "Bash",
            "run_terminal_command": "Bash",
            # Search operations
            "search_file_content": "Grep",
            "codebase_search": "Grep",
            "grep": "Grep",
            "find_files": "Glob",
            "glob": "Glob",
            "list_directory": "LS",
            "list_dir": "LS",
            "ls": "LS",
            "semSearch": "SemSearch",
            # Web operations
            "google_web_search": "WebSearch",
            "web_search": "WebSearch",
            "googlesearch": "WebSearch",
            "web_fetch": "WebFetch",
            "fetch": "WebFetch",
            # Task/Memory operations
            "save_memory": "SaveMemory",
            # Codex operations
            "exec_command": "Bash",
            "apply_patch": "Edit",
            "mcp_tool_call": "MCPTool",
            # Generic simple names
            "search": "Grep",
        }
        return tool_mapping.get(tool_name, tool_mapping.get(key_lower, key))

    def _get_clean_tool_display(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Return a concise, Claude-like tool usage display line."""
        normalized_name = self._normalize_tool_name(tool_name)

        if normalized_name == "Read":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Reading {filename}"
            return "Reading file"
        elif normalized_name == "Write":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Writing {filename}"
            return "Writing file"
        elif normalized_name == "Edit":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Editing {filename}"
            return "Editing file"
        elif normalized_name == "Bash":
            command = (
                tool_input.get("command")
                or tool_input.get("cmd")
                or tool_input.get("script", "")
            )
            if command:
                cmd_display = command.split()[0] if command.split() else command
                return f"Running {cmd_display}"
            return "Running command"
        elif normalized_name == "LS":
            return "Listing directory"
        elif normalized_name == "TodoWrite":
            return "Planning next steps"
        elif normalized_name == "WebSearch":
            query = tool_input.get("query", "")
            if query:
                return f"Searching: {query[:50]}..."
            return "Web search"
        elif normalized_name == "WebFetch":
            url = tool_input.get("url", "")
            if url:
                domain = (
                    url.split("//")[-1].split("/")[0]
                    if "//" in url
                    else url.split("/")[0]
                )
                return f"Fetching from {domain}"
            return "Fetching web content"
        else:
            return f"Using {tool_name}"

    def _create_tool_summary(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Create a visual markdown summary for tool usage.

        NOTE: Special-cases Codex `apply_patch` to render one-line summaries per
        file similar to Claude Code.
        """
        # Handle apply_patch BEFORE normalization to avoid confusion with Edit
        if tool_name == "apply_patch":
            changes = tool_input.get("changes", {})
            if isinstance(changes, dict) and changes:
                if len(changes) == 1:
                    path, change = next(iter(changes.items()))
                    filename = str(path).split("/")[-1]
                    if isinstance(change, dict):
                        if "add" in change:
                            return f"**Write** `{filename}`"
                        elif "delete" in change:
                            return f"**Delete** `{filename}`"
                        elif "update" in change:
                            upd = change.get("update") or {}
                            move_path = upd.get("move_path")
                            if move_path:
                                new_filename = move_path.split("/")[-1]
                                return f"**Rename** `{filename}` → `{new_filename}`"
                            else:
                                return f"**Edit** `{filename}`"
                        else:
                            return f"**Edit** `{filename}`"
                    else:
                        return f"**Edit** `{filename}`"
                else:
                    file_summaries: List[str] = []
                    for raw_path, change in list(changes.items())[:3]:  # max 3 files
                        path = str(raw_path)
                        filename = path.split("/")[-1]
                        if isinstance(change, dict):
                            if "add" in change:
                                file_summaries.append(f"• **Write** `{filename}`")
                            elif "delete" in change:
                                file_summaries.append(f"• **Delete** `{filename}`")
                            elif "update" in change:
                                upd = change.get("update") or {}
                                move_path = upd.get("move_path")
                                if move_path:
                                    new_filename = move_path.split("/")[-1]
                                    file_summaries.append(
                                        f"• **Rename** `{filename}` → `{new_filename}`"
                                    )
                                else:
                                    file_summaries.append(f"• **Edit** `{filename}`")
                            else:
                                file_summaries.append(f"• **Edit** `{filename}`")
                        else:
                            file_summaries.append(f"• **Edit** `{filename}`")

                    result = "\n".join(file_summaries)
                    if len(changes) > 3:
                        result += f"\n• ... +{len(changes) - 3} more files"
                    return result
            return "**ApplyPatch** `files`"

        # Normalize name after handling apply_patch
        normalized_name = self._normalize_tool_name(tool_name)

        if normalized_name == "Edit":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Edit** `{display_path}`"
            return "**Edit** `file`"
        elif normalized_name == "Read":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Read** `{display_path}`"
            return "**Read** `file`"
        elif normalized_name == "Bash":
            command = (
                tool_input.get("command")
                or tool_input.get("cmd")
                or tool_input.get("script", "")
            )
            if command:
                display_cmd = command[:40] + "..." if len(command) > 40 else command
                return f"**Bash** `{display_cmd}`"
            return "**Bash** `command`"
        elif normalized_name == "TodoWrite":
            return "`Planning for next moves...`"
        elif normalized_name == "SaveMemory":
            fact = tool_input.get("fact", "")
            if fact:
                return f"**SaveMemory** `{fact[:40]}{'...' if len(fact) > 40 else ''}`"
            return "**SaveMemory** `storing information`"
        elif normalized_name == "Grep":
            pattern = (
                tool_input.get("pattern")
                or tool_input.get("query")
                or tool_input.get("search", "")
            )
            path = (
                tool_input.get("path")
                or tool_input.get("file")
                or tool_input.get("directory", "")
            )
            if pattern:
                if path:
                    display_path = get_display_path(path)
                    return f"**Search** `{pattern}` in `{display_path}`"
                return f"**Search** `{pattern}`"
            return "**Search** `pattern`"
        elif normalized_name == "Glob":
            if tool_name == "find_files":
                name = tool_input.get("name", "")
                if name:
                    return f"**Glob** `{name}`"
                return "**Glob** `finding files`"
            pattern = tool_input.get("pattern", "") or tool_input.get(
                "globPattern", ""
            )
            if pattern:
                return f"**Glob** `{pattern}`"
            return "**Glob** `pattern`"
        elif normalized_name == "Write":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Write** `{display_path}`"
            return "**Write** `file`"
        elif normalized_name == "MultiEdit":
            file_path = (
                tool_input.get("file_path")
                or tool_input.get("path")
                or tool_input.get("file", "")
            )
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"🔧 **MultiEdit** `{display_path}`"
            return "🔧 **MultiEdit** `file`"
        elif normalized_name == "LS":
            path = (
                tool_input.get("path")
                or tool_input.get("directory")
                or tool_input.get("dir", "")
            )
            if path:
                display_path = get_display_path(path)
                if len(display_path) > 40:
                    display_path = "…/" + display_path[-37:]
                return f"📁 **LS** `{display_path}`"
            return "📁 **LS** `directory`"
        elif normalized_name == "WebFetch":
            url = tool_input.get("url", "")
            if url:
                domain = (
                    url.split("//")[-1].split("/")[0]
                    if "//" in url
                    else url.split("/")[0]
                )
                return f"**WebFetch** [{domain}]({url})"
            return "**WebFetch** `url`"
        elif normalized_name == "WebSearch":
            query = tool_input.get("query") or tool_input.get("search_query", "")
            query = tool_input.get("query", "")
            if query:
                short_query = query[:40] + "..." if len(query) > 40 else query
                return f"**WebSearch** `{short_query}`"
            return "**WebSearch** `query`"
        elif normalized_name == "Task":
            description = tool_input.get("description", "")
            subagent_type = tool_input.get("subagent_type", "")
            if description and subagent_type:
                return (
                    f"🤖 **Task** `{subagent_type}`\n> "
                    f"{description[:50]}{'...' if len(description) > 50 else ''}"
                )
            elif description:
                return f"🤖 **Task** `{description[:40]}{'...' if len(description) > 40 else ''}`"
            return "🤖 **Task** `subtask`"
        elif normalized_name == "ExitPlanMode":
            return "✅ **ExitPlanMode** `planning complete`"
        elif normalized_name == "NotebookEdit":
            notebook_path = tool_input.get("notebook_path", "")
            if notebook_path:
                filename = notebook_path.split("/")[-1]
                return f"📓 **NotebookEdit** `{filename}`"
            return "📓 **NotebookEdit** `notebook`"
        elif normalized_name == "MCPTool" or tool_name == "mcp_tool_call":
            server = tool_input.get("server", "")
            tool_name_inner = tool_input.get("tool", "")
            if server and tool_name_inner:
                return f"🔧 **MCP** `{server}.{tool_name_inner}`"
            return "🔧 **MCP** `tool call`"
        elif tool_name == "exec_command":
            command = tool_input.get("command", "")
            if command:
                display_cmd = command[:40] + "..." if len(command) > 40 else command
                return f"⚡ **Exec** `{display_cmd}`"
            return "⚡ **Exec** `command`"
        else:
            return f"**{tool_name}** `executing...`"
