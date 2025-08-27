"""
Unified CLI Manager for Multi-AI Agent Support
Supports Claude Code SDK, Cursor Agent, Qwen Code, Gemini CLI, and Codex CLI
"""
import asyncio
import json
import os
import subprocess
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Callable, Dict, Any, AsyncGenerator, List
from enum import Enum
import tempfile
import base64


def get_project_root() -> str:
    """Get project root directory using relative path navigation"""
    current_file_dir = os.path.dirname(os.path.abspath(__file__))
    # unified_manager.py is in: app/services/cli/
    # Navigate: cli -> services -> app -> api -> apps -> project-root
    project_root = os.path.join(current_file_dir, "..", "..", "..", "..", "..")
    return os.path.abspath(project_root)


def get_display_path(file_path: str) -> str:
    """Convert absolute path to relative display path"""
    try:
        project_root = get_project_root()
        if file_path.startswith(project_root):
            # Remove project root from path
            display_path = file_path.replace(project_root + "/", "")
            return display_path.replace("data/projects/", "…/")
    except Exception:
        pass
    return file_path

from app.models.messages import Message
from app.models.sessions import Session
from app.core.websocket.manager import manager as ws_manager
from app.core.terminal_ui import ui

# Claude Code SDK imports
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions


# Model mapping from unified names to CLI-specific names
MODEL_MAPPING = {
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
        "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022"
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
        "claude-opus-4-1-20250805": "opus-4.1"
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
        "claude-haiku-3.5": "claude-3-haiku"
    }
}


class CLIType(str, Enum):
    CLAUDE = "claude"
    CURSOR = "cursor"
    CODEX = "codex"


class BaseCLI(ABC):
    """Abstract base class for all CLI implementations"""
    
    def __init__(self, cli_type: CLIType):
        self.cli_type = cli_type
    
    def _get_cli_model_name(self, model: Optional[str]) -> Optional[str]:
        """Convert unified model name to CLI-specific model name"""
        if not model:
            return None
        
        from app.core.terminal_ui import ui
        
        ui.debug(f"Input model: '{model}' for CLI: {self.cli_type.value}", "Model")
        cli_models = MODEL_MAPPING.get(self.cli_type.value, {})
        
        # Try exact match first
        if model in cli_models:
            mapped_model = cli_models[model]
            ui.info(f"Mapped '{model}' to '{mapped_model}' for {self.cli_type.value}", "Model")
            return mapped_model
        
        # Try direct model name (already CLI-specific)
        if model in cli_models.values():
            ui.info(f"Using direct model name '{model}' for {self.cli_type.value}", "Model")
            return model
        
        # For debugging: show available models
        available_models = list(cli_models.keys())
        ui.warning(f"Model '{model}' not found in mapping for {self.cli_type.value}", "Model")
        ui.debug(f"Available models for {self.cli_type.value}: {available_models}", "Model")
        ui.warning(f"Using model as-is: '{model}'", "Model")
        return model
    
    def get_supported_models(self) -> List[str]:
        """Get list of supported models for this CLI"""
        cli_models = MODEL_MAPPING.get(self.cli_type.value, {})
        return list(cli_models.keys()) + list(cli_models.values())
    
    def is_model_supported(self, model: str) -> bool:
        """Check if a model is supported by this CLI"""
        return model in self.get_supported_models() or model in MODEL_MAPPING.get(self.cli_type.value, {}).values()
    
    @abstractmethod
    async def check_availability(self) -> Dict[str, Any]:
        """Check if CLI is available and configured"""
        pass
    
    @abstractmethod
    async def execute_with_streaming(
        self,
        instruction: str,
        project_path: str,
        session_id: Optional[str] = None,
        log_callback: Optional[Callable] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False
    ) -> AsyncGenerator[Message, None]:
        """Execute instruction and yield messages in real-time"""
        pass
    
    @abstractmethod
    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Get current session ID for project"""
        pass
    
    @abstractmethod
    async def set_session_id(self, project_id: str, session_id: str) -> None:
        """Set session ID for project"""
        pass
    
    
    def parse_message_data(self, data: Dict[str, Any], project_id: str, session_id: str) -> Message:
        """Parse CLI-specific message data to unified Message format"""
        return Message(
            id=str(uuid.uuid4()),
            project_id=project_id,
            role=self._normalize_role(data.get("role", "assistant")),
            message_type="chat",
            content=self._extract_content(data),
            metadata_json={
                **data,
                "cli_type": self.cli_type.value,
                "original_format": data
            },
            session_id=session_id,
            created_at=datetime.utcnow()
        )
    
    def _normalize_role(self, role: str) -> str:
        """Normalize different CLI role formats"""
        role_mapping = {
            "model": "assistant",
            "ai": "assistant", 
            "human": "user",
            "bot": "assistant"
        }
        return role_mapping.get(role.lower(), role.lower())
    
    def _extract_content(self, data: Dict[str, Any]) -> str:
        """Extract content from CLI-specific data format"""
        
        # Handle Claude's complex content array structure
        if "content" in data and isinstance(data["content"], list):
            content = ""
            for item in data["content"]:
                if item.get("type") == "text":
                    content += item.get("text", "")
                elif item.get("type") == "tool_use":
                    tool_name = item.get("name", "Unknown")
                    tool_input = item.get("input", {})
                    
                    # Create simplified tool use summary
                    summary = self._create_tool_summary(tool_name, tool_input)
                    content += f"{summary}\n"
            return content
        
        # Handle simple content string
        elif "content" in data:
            return str(data["content"])
        
        # Handle Gemini parts format
        elif "parts" in data:
            content = ""
            for part in data["parts"]:
                if "text" in part:
                    content += part.get("text", "")
                elif "functionCall" in part:
                    func_call = part["functionCall"]
                    tool_name = func_call.get('name', 'Unknown')
                    tool_input = func_call.get("args", {})
                    summary = self._create_tool_summary(tool_name, tool_input)
                    content += f"{summary}\n"
            return content
        
        # Handle OpenAI/Codex format with choices
        elif "choices" in data and data["choices"]:
            choice = data["choices"][0]
            if "message" in choice:
                return choice["message"].get("content", "")
            elif "text" in choice:
                return choice.get("text", "")
        
        # Handle direct text fields
        elif "text" in data:
            return str(data["text"])
        elif "message" in data:
            # Handle nested message structure
            if isinstance(data["message"], dict):
                return self._extract_content(data["message"])
            return str(data["message"])
        
        # Handle response field (common in many APIs)
        elif "response" in data:
            return str(data["response"])
        
        # Handle delta streaming format
        elif "delta" in data and "content" in data["delta"]:
            return str(data["delta"]["content"])
        
        # Fallback: convert entire data to string
        else:
            return str(data)
    
    def _normalize_tool_name(self, tool_name: str) -> str:
        """Normalize different CLI tool names to unified format"""
        tool_mapping = {
            # File operations
            "read_file": "Read", "read": "Read",
            "write_file": "Write", "write": "Write",
            "edit_file": "Edit",
            "replace": "Edit", "edit": "Edit",
            "delete": "Delete",

            # Terminal operations
            "shell": "Bash",
            "run_terminal_command": "Bash",

            # Search operations
            "search_file_content": "Grep",
            "codebase_search": "Grep", "grep": "Grep",
            "find_files": "Glob", "glob": "Glob",
            "list_directory": "LS",
            "list_dir": "LS", "ls": "LS",
            "semSearch": "SemSearch",

            # Web operations
            "google_web_search": "WebSearch",
            "web_search": "WebSearch",
            "web_fetch": "WebFetch",

            # Task/Memory operations
            "save_memory": "SaveMemory",
            
            # Codex operations
            "exec_command": "Bash",
            "apply_patch": "Edit",
            "mcp_tool_call": "MCPTool",
        }

        return tool_mapping.get(tool_name, tool_name)

    def _get_clean_tool_display(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Create a clean tool display like Claude Code"""
        normalized_name = self._normalize_tool_name(tool_name)
        
        if normalized_name == "Read":
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Reading {filename}"
            return "Reading file"
        elif normalized_name == "Write":
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Writing {filename}"
            return "Writing file"
        elif normalized_name == "Edit":
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                filename = file_path.split("/")[-1]
                return f"Editing {filename}"
            return "Editing file"
        elif normalized_name == "Bash":
            command = tool_input.get("command") or tool_input.get("cmd") or tool_input.get("script", "")
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
                domain = url.split("//")[-1].split("/")[0] if "//" in url else url.split("/")[0]
                return f"Fetching from {domain}"
            return "Fetching web content"
        else:
            return f"Using {tool_name}"

    def _create_tool_summary(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Create a visual markdown summary for tool usage"""
        # Handle apply_patch BEFORE normalization to avoid confusion with Edit
        if tool_name == "apply_patch":
            # Handle apply_patch from Codex - show individual files like Claude Code
            changes = tool_input.get("changes", {})
            if isinstance(changes, dict) and changes:
                # For single file, show like Claude Code format
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
                
                # For multiple files, show individual actions without header
                else:
                    file_summaries = []
                    for raw_path, change in list(changes.items())[:3]:  # Show max 3 files
                        path = str(raw_path)
                        filename = path.split("/")[-1]  # Get just filename
                        
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
                                    file_summaries.append(f"• **Rename** `{filename}` → `{new_filename}`")
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
        
        # Normalize the tool name first
        normalized_name = self._normalize_tool_name(tool_name)
        
        if normalized_name == "Edit":
            # Handle different argument names from different CLIs
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Edit** `{display_path}`"
            return "**Edit** `file`"
        elif normalized_name == "Read":
            # Handle different argument names from different CLIs
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Read** `{display_path}`"
            return "**Read** `file`"
        elif normalized_name == "Bash":
            # Handle different command argument names
            command = tool_input.get("command") or tool_input.get("cmd") or tool_input.get("script", "")
            if command:
                display_cmd = command[:40] + "..." if len(command) > 40 else command
                return f"**Bash** `{display_cmd}`"
            return "**Bash** `command`"
        elif normalized_name == "TodoWrite":
            return "`Planning for next moves...`"
        elif normalized_name == "SaveMemory":
            # Handle save_memory from Gemini CLI
            fact = tool_input.get("fact", "")
            if fact:
                return f"**SaveMemory** `{fact[:40]}{'...' if len(fact) > 40 else ''}`"
            return "**SaveMemory** `storing information`"
        elif normalized_name == "Grep":
            # Handle different search tool arguments
            pattern = tool_input.get("pattern") or tool_input.get("query") or tool_input.get("search", "")
            path = tool_input.get("path") or tool_input.get("file") or tool_input.get("directory", "")
            if pattern:
                if path:
                    display_path = get_display_path(path)
                    return f"**Search** `{pattern}` in `{display_path}`"
                return f"**Search** `{pattern}`"
            return "**Search** `pattern`"
        elif normalized_name == "Glob":
            # Handle find_files from Cursor Agent
            if tool_name == "find_files":
                name = tool_input.get("name", "")
                if name:
                    return f"**Glob** `{name}`"
                return "**Glob** `finding files`"
            pattern = tool_input.get("pattern", "") or tool_input.get("globPattern", "")
            if pattern:
                return f"**Glob** `{pattern}`"
            return "**Glob** `pattern`"
        elif normalized_name == "Write":
            # Handle different argument names from different CLIs
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Write** `{display_path}`"
            return "**Write** `file`"
        elif normalized_name == "MultiEdit":
            # Handle different argument names from different CLIs
            file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file", "")
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"🔧 **MultiEdit** `{display_path}`"
            return "🔧 **MultiEdit** `file`"
        elif normalized_name == "LS":
            # Handle list_dir from Cursor Agent and list_directory from Gemini
            path = tool_input.get("path") or tool_input.get("directory") or tool_input.get("dir", "")
            if path:
                display_path = get_display_path(path)
                if len(display_path) > 40:
                    display_path = "…/" + display_path[-37:]
                return f"📁 **LS** `{display_path}`"
            return "📁 **LS** `directory`"
        elif normalized_name == "Delete":
            file_path = tool_input.get("path", "")
            if file_path:
                display_path = get_display_path(file_path)
                if len(display_path) > 40:
                    display_path = "…/" + "/".join(display_path.split("/")[-2:])
                return f"**Delete** `{display_path}`"
            return "**Delete** `file`"
        elif normalized_name == "SemSearch":
            query = tool_input.get("query", "")
            if query:
                short_query = query[:40] + "..." if len(query) > 40 else query
                return f"**SemSearch** `{short_query}`"
            return "**SemSearch** `query`"
        elif normalized_name == "WebFetch":
            # Handle web_fetch from Gemini CLI
            url = tool_input.get("url", "")
            prompt = tool_input.get("prompt", "")
            if url and prompt:
                domain = url.split("//")[-1].split("/")[0] if "//" in url else url.split("/")[0]
                short_prompt = prompt[:30] + "..." if len(prompt) > 30 else prompt
                return f"**WebFetch** [{domain}]({url})\n> {short_prompt}"
            elif url:
                domain = url.split("//")[-1].split("/")[0] if "//" in url else url.split("/")[0]
                return f"**WebFetch** [{domain}]({url})"
            return "**WebFetch** `url`"
        elif normalized_name == "WebSearch":
            # Handle google_web_search from Gemini CLI and web_search from Cursor Agent
            query = tool_input.get("query") or tool_input.get("search_query", "")
            query = tool_input.get("query", "")
            if query:
                short_query = query[:40] + "..." if len(query) > 40 else query
                return f"**WebSearch** `{short_query}`"
            return "**WebSearch** `query`"
        elif normalized_name == "Task":
            # Handle Task tool from Claude Code
            description = tool_input.get("description", "")
            subagent_type = tool_input.get("subagent_type", "")
            if description and subagent_type:
                return f"🤖 **Task** `{subagent_type}`\n> {description[:50]}{'...' if len(description) > 50 else ''}"
            elif description:
                return f"🤖 **Task** `{description[:40]}{'...' if len(description) > 40 else ''}`"
            return "🤖 **Task** `subtask`"
        elif normalized_name == "ExitPlanMode":
            # Handle ExitPlanMode from Claude Code
            return "✅ **ExitPlanMode** `planning complete`"
        elif normalized_name == "NotebookEdit":
            # Handle NotebookEdit from Claude Code
            notebook_path = tool_input.get("notebook_path", "")
            if notebook_path:
                filename = notebook_path.split("/")[-1]
                return f"📓 **NotebookEdit** `{filename}`"
            return "📓 **NotebookEdit** `notebook`"
        elif normalized_name == "MCPTool" or tool_name == "mcp_tool_call":
            # Handle MCP tool calls from Codex
            server = tool_input.get("server", "")
            tool_name_inner = tool_input.get("tool", "")
            if server and tool_name_inner:
                return f"🔧 **MCP** `{server}.{tool_name_inner}`"
            return "🔧 **MCP** `tool call`"
        elif tool_name == "exec_command":
            # Handle exec_command from Codex (same as Bash)
            command = tool_input.get("command", "")
            if command:
                display_cmd = command[:40] + "..." if len(command) > 40 else command
                return f"⚡ **Exec** `{display_cmd}`"
            return "⚡ **Exec** `command`"
        else:
            return f"**{tool_name}** `executing...`"


class ClaudeCodeCLI(BaseCLI):
    """Claude Code Python SDK implementation"""
    
    def __init__(self):
        super().__init__(CLIType.CLAUDE)
        self.session_mapping: Dict[str, str] = {}
    
    async def check_availability(self) -> Dict[str, Any]:
        """Check if Claude Code CLI is available"""
        try:
            # First try to check if claude CLI is installed and working
            result = await asyncio.create_subprocess_shell(
                "claude -h",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": "Claude Code CLI not installed or not working.\n\nTo install:\n1. Install Claude Code: npm install -g @anthropic-ai/claude-code\n2. Login to Claude: claude login\n3. Try running your prompt again"
                }
            
            # Check if help output contains expected content
            help_output = stdout.decode() + stderr.decode()
            if "claude" not in help_output.lower():
                return {
                    "available": False,
                    "configured": False,
                    "error": "Claude Code CLI not responding correctly.\n\nPlease try:\n1. Reinstall: npm install -g @anthropic-ai/claude-code\n2. Login: claude login\n3. Check installation: claude -h"
                }
            
            return {
                "available": True,
                "configured": True,
                "mode": "CLI",
                "models": self.get_supported_models(),
                "default_models": ["claude-sonnet-4-20250514", "claude-opus-4-1-20250805"]
            }
        except Exception as e:
            return {
                "available": False,
                "configured": False,
                "error": f"Failed to check Claude Code CLI: {str(e)}\n\nTo install:\n1. Install Claude Code: npm install -g @anthropic-ai/claude-code\n2. Login to Claude: claude login"
            }
    
    async def execute_with_streaming(
        self,
        instruction: str,
        project_path: str,
        session_id: Optional[str] = None,
        log_callback: Optional[Callable] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False
    ) -> AsyncGenerator[Message, None]:
        """Execute instruction using Claude Code Python SDK"""
        from app.core.terminal_ui import ui
        
        ui.info("Starting Claude SDK execution", "Claude SDK")
        ui.debug(f"Instruction: {instruction[:100]}...", "Claude SDK")
        ui.debug(f"Project path: {project_path}", "Claude SDK")
        ui.debug(f"Session ID: {session_id}", "Claude SDK")
        
        if log_callback:
            await log_callback("Starting execution...")
        
        # Load system prompt
        try:
            from app.services.claude_act import get_system_prompt
            system_prompt = get_system_prompt()
            ui.debug(f"System prompt loaded: {len(system_prompt)} chars", "Claude SDK")
        except Exception as e:
            ui.error(f"Failed to load system prompt: {e}", "Claude SDK")
            system_prompt = "You are Claude Code, an AI coding assistant specialized in building modern web applications."
        
        # Get CLI-specific model name
        cli_model = self._get_cli_model_name(model) or "claude-sonnet-4-20250514"
        
        # Add project directory structure for initial prompts
        if is_initial_prompt:
            project_structure_info = """
<initial_context>
## Project Directory Structure (node_modules are already installed)
.eslintrc.json
.gitignore
next.config.mjs
next-env.d.ts
package.json
postcss.config.mjs
README.md
tailwind.config.ts
tsconfig.json
.env
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
public/
node_modules/
</initial_context>"""
            instruction = instruction + project_structure_info
            ui.info(f"Added project structure info to initial prompt", "Claude SDK")
        
        # Configure tools based on initial prompt status
        if is_initial_prompt:
            # For initial prompts: use disallowed_tools to explicitly block TodoWrite
            allowed_tools = [
                "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS",
                "WebFetch", "WebSearch"
            ]
            disallowed_tools = ["TodoWrite"]
            
            ui.info(f"TodoWrite tool EXCLUDED via disallowed_tools (is_initial_prompt: {is_initial_prompt})", "Claude SDK")
            ui.debug(f"Allowed tools: {allowed_tools}", "Claude SDK")
            ui.debug(f"Disallowed tools: {disallowed_tools}", "Claude SDK")
            
            # Configure Claude Code options with disallowed_tools
            options = ClaudeCodeOptions(
                system_prompt=system_prompt,
                allowed_tools=allowed_tools,
                disallowed_tools=disallowed_tools,
                permission_mode="bypassPermissions",
                model=cli_model,
                continue_conversation=True
            )
        else:
            # For non-initial prompts: include TodoWrite in allowed tools
            allowed_tools = [
                "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS",
                "WebFetch", "WebSearch", "TodoWrite"
            ]
            
            ui.info(f"TodoWrite tool INCLUDED (is_initial_prompt: {is_initial_prompt})", "Claude SDK")
            ui.debug(f"Allowed tools: {allowed_tools}", "Claude SDK")
            
            # Configure Claude Code options without disallowed_tools
            options = ClaudeCodeOptions(
                system_prompt=system_prompt,
                allowed_tools=allowed_tools,
                permission_mode="bypassPermissions",
                model=cli_model,
                continue_conversation=True
            )
        
        ui.info(f"Using model: {cli_model}", "Claude SDK")
        ui.debug(f"Project path: {project_path}", "Claude SDK")
        ui.debug(f"Instruction: {instruction[:100]}...", "Claude SDK")
        
        try:
            # Change to project directory
            original_cwd = os.getcwd()
            os.chdir(project_path)
            
            # Get project ID for session management
            project_id = project_path.split("/")[-1] if "/" in project_path else project_path
            existing_session_id = await self.get_session_id(project_id)
            
            # Update options with resume session if available
            if existing_session_id:
                options.resumeSessionId = existing_session_id
                ui.info(f"Resuming session: {existing_session_id}", "Claude SDK")
            
            try:
                async with ClaudeSDKClient(options=options) as client:
                    # Send initial query
                    await client.query(instruction)
                    
                    # Stream responses and extract session_id
                    claude_session_id = None
                    
                    async for message_obj in client.receive_messages():
                        
                        # Import SDK types for isinstance checks
                        try:
                            from anthropic.claude_code.types import SystemMessage, AssistantMessage, UserMessage, ResultMessage
                        except ImportError:
                            try:
                                from claude_code_sdk.types import SystemMessage, AssistantMessage, UserMessage, ResultMessage
                            except ImportError:
                                # Fallback - check type name strings
                                SystemMessage = type(None)
                                AssistantMessage = type(None)
                                UserMessage = type(None)
                                ResultMessage = type(None)
                        
                        # Handle SystemMessage for session_id extraction
                        if (isinstance(message_obj, SystemMessage) or 
                            'SystemMessage' in str(type(message_obj))):
                            # Extract session_id if available
                            if hasattr(message_obj, 'session_id') and message_obj.session_id:
                                claude_session_id = message_obj.session_id
                                await self.set_session_id(project_id, claude_session_id)
                            
                            # Send init message (hidden from UI)
                            init_message = Message(
                                id=str(uuid.uuid4()),
                                project_id=project_path,
                                role="system",
                                message_type="system",
                                content=f"Claude Code SDK initialized (Model: {cli_model})",
                                metadata_json={
                                    "cli_type": self.cli_type.value,
                                    "mode": "SDK",
                                    "model": cli_model,
                                    "session_id": getattr(message_obj, 'session_id', None),
                                    "hidden_from_ui": True
                                },
                                session_id=session_id,
                                created_at=datetime.utcnow()
                            )
                            yield init_message
                        
                        # Handle AssistantMessage (complete messages)
                        elif (isinstance(message_obj, AssistantMessage) or 
                              'AssistantMessage' in str(type(message_obj))):
                            
                            content = ""
                            
                            # Process content - AssistantMessage has content: list[ContentBlock]
                            if hasattr(message_obj, 'content') and isinstance(message_obj.content, list):
                                for block in message_obj.content:
                                    
                                    # Import block types for comparison
                                    from claude_code_sdk.types import TextBlock, ToolUseBlock, ToolResultBlock
                                    
                                    if isinstance(block, TextBlock):
                                        # TextBlock has 'text' attribute
                                        content += block.text
                                    elif isinstance(block, ToolUseBlock):
                                        # ToolUseBlock has 'id', 'name', 'input' attributes
                                        tool_name = block.name
                                        tool_input = block.input
                                        tool_id = block.id
                                        summary = self._create_tool_summary(tool_name, tool_input)
                                            
                                        # Yield tool use message immediately
                                        tool_message = Message(
                                            id=str(uuid.uuid4()),
                                            project_id=project_path,
                                            role="assistant",
                                            message_type="tool_use",
                                            content=summary,
                                            metadata_json={
                                                "cli_type": self.cli_type.value,
                                                "mode": "SDK",
                                                "tool_name": tool_name,
                                                "tool_input": tool_input,
                                                "tool_id": tool_id
                                            },
                                            session_id=session_id,
                                            created_at=datetime.utcnow()
                                        )
                                        # Display clean tool usage like Claude Code
                                        tool_display = self._get_clean_tool_display(tool_name, tool_input)
                                        ui.info(tool_display, "")
                                        yield tool_message
                                    elif isinstance(block, ToolResultBlock):
                                        # Handle tool result blocks if needed
                                        pass
                            
                            # Yield complete assistant text message if there's text content
                            if content and content.strip():
                                text_message = Message(
                                    id=str(uuid.uuid4()),
                                    project_id=project_path,
                                    role="assistant",
                                    message_type="chat",
                                    content=content.strip(),
                                    metadata_json={
                                        "cli_type": self.cli_type.value,
                                        "mode": "SDK"
                                    },
                                    session_id=session_id,
                                    created_at=datetime.utcnow()
                                )
                                yield text_message
                        
                        # Handle UserMessage (tool results, etc.)
                        elif (isinstance(message_obj, UserMessage) or 
                              'UserMessage' in str(type(message_obj))):
                            # UserMessage has content: str according to types.py
                            # UserMessages are typically tool results - we don't need to show them
                            pass
                        
                        # Handle ResultMessage (final session completion)
                        elif (
                            isinstance(message_obj, ResultMessage) or
                            'ResultMessage' in str(type(message_obj)) or
                            (hasattr(message_obj, 'type') and getattr(message_obj, 'type', None) == 'result')
                        ):
                            ui.success(f"Session completed in {getattr(message_obj, 'duration_ms', 0)}ms", "Claude SDK")
                            
                            # Create internal result message (hidden from UI)
                            result_message = Message(
                                id=str(uuid.uuid4()),
                                project_id=project_path,
                                role="system",
                                message_type="result",
                                content=f"Session completed in {getattr(message_obj, 'duration_ms', 0)}ms",
                                metadata_json={
                                    "cli_type": self.cli_type.value,
                                    "mode": "SDK",
                                    "duration_ms": getattr(message_obj, 'duration_ms', 0),
                                    "duration_api_ms": getattr(message_obj, 'duration_api_ms', 0),
                                    "total_cost_usd": getattr(message_obj, 'total_cost_usd', 0),
                                    "num_turns": getattr(message_obj, 'num_turns', 0),
                                    "is_error": getattr(message_obj, 'is_error', False),
                                    "subtype": getattr(message_obj, 'subtype', None),
                                    "session_id": getattr(message_obj, 'session_id', None),
                                    "hidden_from_ui": True  # Don't show to user
                                },
                                session_id=session_id,
                                created_at=datetime.utcnow()
                            )
                            yield result_message
                            break
                        
                        # Handle unknown message types
                        else:
                            ui.debug(f"Unknown message type: {type(message_obj)}", "Claude SDK")
            
            finally:
                # Restore original working directory
                os.chdir(original_cwd)
                
        except Exception as e:
            ui.error(f"Exception occurred: {str(e)}", "Claude SDK")
            if log_callback:
                await log_callback(f"Claude SDK Exception: {str(e)}")
            raise
    
    
    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Get current session ID for project from database"""
        try:
            # Try to get from database if available (we'll need to pass db session)
            return self.session_mapping.get(project_id)
        except Exception as e:
            ui.warning(f"Failed to get session ID from DB: {e}", "Claude SDK")
            return self.session_mapping.get(project_id)
    
    async def set_session_id(self, project_id: str, session_id: str) -> None:
        """Set session ID for project in database and memory"""
        try:
            # Store in memory as fallback
            self.session_mapping[project_id] = session_id
            ui.debug(f"Session ID stored for project {project_id}", "Claude SDK")
        except Exception as e:
            ui.warning(f"Failed to save session ID: {e}", "Claude SDK")
            # Fallback to memory storage
            self.session_mapping[project_id] = session_id


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
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                return {
                    "available": False,
                    "configured": False,
                    "error": "Cursor Agent CLI not installed or not working.\n\nTo install:\n1. Install Cursor: curl https://cursor.com/install -fsS | bash\n2. Login to Cursor: cursor-agent login\n3. Try running your prompt again"
                }
            
            # Check if help output contains expected content
            help_output = stdout.decode() + stderr.decode()
            if "cursor-agent" not in help_output.lower():
                return {
                    "available": False,
                    "configured": False,
                    "error": "Cursor Agent CLI not responding correctly.\n\nPlease try:\n1. Reinstall: curl https://cursor.com/install -fsS | bash\n2. Login: cursor-agent login\n3. Check installation: cursor-agent -h"
                }
            
            return {
                "available": True,
                "configured": True,
                "models": self.get_supported_models(),
                "default_models": ["gpt-5", "sonnet-4"]
            }
        except Exception as e:
            return {
                "available": False,
                "configured": False,
                "error": f"Failed to check Cursor Agent: {str(e)}\n\nTo install:\n1. Install Cursor: curl https://cursor.com/install -fsS | bash\n2. Login to Cursor: cursor-agent login"
            }
    
    def _handle_cursor_stream_json(self, event: Dict[str, Any], project_path: str, session_id: str) -> Optional[Message]:
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
                    "hidden_from_ui": True  # Hide system init messages
                },
                session_id=session_id,
                created_at=datetime.utcnow()
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
                        "original_event": event
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow()
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
                        "original_event": event
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow()
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
                        "hidden_from_ui": True
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow()
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
                    content=f"Execution completed in {duration}ms. Final result: {result_text}",
                    metadata_json={
                        "cli_type": self.cli_type.value,
                        "event_type": "result",
                        "duration_ms": duration,
                        "original_event": event,
                        "hidden_from_ui": True
                    },
                    session_id=session_id,
                    created_at=datetime.utcnow()
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
            # unified_manager.py is in: app/services/cli/
            # Navigate: cli -> services -> app
            app_dir = os.path.join(current_file_dir, "..", "..")
            app_dir = os.path.abspath(app_dir)
            system_prompt_path = os.path.join(app_dir, "prompt", "system-prompt.md")
            
            if os.path.exists(system_prompt_path):
                with open(system_prompt_path, 'r', encoding='utf-8') as f:
                    system_prompt_content = f.read()
                
                # Write to AGENTS.md in the project repo
                with open(agent_md_path, 'w', encoding='utf-8') as f:
                    f.write(system_prompt_content)
                
                print(f"📝 [Cursor] Created AGENTS.md at: {agent_md_path}")
            else:
                print(f"⚠️ [Cursor] System prompt file not found at: {system_prompt_path}")
        except Exception as e:
            print(f"❌ [Cursor] Failed to create AGENTS.md: {e}")

    async def execute_with_streaming(
        self,
        instruction: str,
        project_path: str,
        session_id: Optional[str] = None,
        log_callback: Optional[Callable] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False
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
            "cursor-agent", "--force",
            "-p", instruction,
            "--output-format", "stream-json"  # Use stream-json format
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
            project_repo_path = project_path # Fallback to project_path if repo subdir doesn't exist

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_repo_path
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
                            print(f"💾 [Cursor] Session ID extracted from result event: {cursor_session_id}")
                        
                        # Mark that we received result event
                        result_received = True
                    
                    # Extract session ID from various event types
                    if not cursor_session_id:
                        # Try to extract session ID from any event that contains it
                        potential_session_id = (
                            event.get("sessionId") or 
                            event.get("chatId") or 
                            event.get("session_id") or 
                            event.get("chat_id") or
                            event.get("threadId") or
                            event.get("thread_id")
                        )
                        
                        # Also check in nested structures
                        if not potential_session_id and isinstance(event.get("message"), dict):
                            potential_session_id = (
                                event["message"].get("sessionId") or
                                event["message"].get("chatId") or
                                event["message"].get("session_id") or
                                event["message"].get("chat_id")
                            )
                        
                        if potential_session_id and potential_session_id != active_session_id:
                            cursor_session_id = potential_session_id
                            await self.set_session_id(project_id, cursor_session_id)
                            print(f"💾 [Cursor] Updated session ID for project {project_id}: {cursor_session_id}")
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
                            metadata_json={"cli_type": "cursor", "event_type": "assistant_aggregated"},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        assistant_message_buffer = ""

                    # Process the event
                    message = self._handle_cursor_stream_json(event, project_path, session_id)
                    
                    if message:
                        if message.role == "assistant" and message.message_type == "chat":
                            assistant_message_buffer += message.content
                        else:
                            if log_callback:
                                await log_callback(f"📝 [Cursor] {message.content}")
                            yield message
                    
                    # ★ CRITICAL: Break after result event to end streaming
                    if result_received:
                        print(f"🏁 [Cursor] Result event received, terminating stream early")
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
                        metadata_json={"cli_type": "cursor", "raw_output": line_str, "parse_error": str(e)},
                        session_id=session_id,
                        created_at=datetime.utcnow()
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
                    metadata_json={"cli_type": "cursor", "event_type": "assistant_aggregated"},
                    session_id=session_id,
                    created_at=datetime.utcnow()
                )

            await process.wait()
            
            # Log completion
            if cursor_session_id:
                print(f"✅ [Cursor] Session completed: {cursor_session_id}")
            
        except FileNotFoundError:
            error_msg = "❌ Cursor Agent CLI not found. Please install with: curl https://cursor.com/install -fsS | bash"
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content=error_msg,
                metadata_json={"error": "cli_not_found", "cli_type": "cursor"},
                session_id=session_id,
                created_at=datetime.utcnow()
            )
        except Exception as e:
            error_msg = f"❌ Cursor Agent execution failed: {str(e)}"
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content=error_msg,
                metadata_json={"error": "execution_failed", "cli_type": "cursor", "exception": str(e)},
                session_id=session_id,
                created_at=datetime.utcnow()
            )
    
    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Get stored session ID for project to enable session continuity"""
        if self.db_session:
            try:
                from app.models.projects import Project
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project and project.active_cursor_session_id:
                    print(f"💾 [Cursor] Retrieved session ID from DB: {project.active_cursor_session_id}")
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
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project:
                    project.active_cursor_session_id = session_id
                    self.db_session.commit()
                    print(f"💾 [Cursor] Session ID saved to DB for project {project_id}: {session_id}")
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
        print(f"💾 [Cursor] Session ID stored in memory for project {project_id}: {session_id}")


class CodexCLI(BaseCLI):
    """Codex CLI implementation with auto-approval and message buffering"""
    
    def __init__(self, db_session=None):
        super().__init__(CLIType.CODEX)
        self.db_session = db_session
        self._session_store = {}  # Fallback for when db_session is not available
    
    async def check_availability(self) -> Dict[str, Any]:
        """Check if Codex CLI is available"""
        print(f"[DEBUG] CodexCLI.check_availability called")
        try:
            # Check if codex is installed and working
            print(f"[DEBUG] Running command: codex --version")
            result = await asyncio.create_subprocess_shell(
                "codex --version",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            print(f"[DEBUG] Command result: returncode={result.returncode}")
            print(f"[DEBUG] stdout: {stdout.decode().strip()}")
            print(f"[DEBUG] stderr: {stderr.decode().strip()}")
            
            if result.returncode != 0:
                error_msg = f"Codex CLI not installed or not working (returncode: {result.returncode}). stderr: {stderr.decode().strip()}"
                print(f"[DEBUG] {error_msg}")
                return {
                    "available": False,
                    "configured": False,
                    "error": error_msg
                }
            
            print(f"[DEBUG] Codex CLI available!")
            return {
                "available": True,
                "configured": True,
                "models": self.get_supported_models(),
                "default_models": ["gpt-5", "gpt-4o", "claude-3.5-sonnet"]
            }
        except Exception as e:
            error_msg = f"Failed to check Codex CLI: {str(e)}"
            print(f"[DEBUG] Exception in check_availability: {error_msg}")
            return {
                "available": False,
                "configured": False,
                "error": error_msg
            }
    
    async def execute_with_streaming(
        self,
        instruction: str,
        project_path: str,
        session_id: Optional[str] = None,
        log_callback: Optional[Callable] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False
    ) -> AsyncGenerator[Message, None]:
        """Execute Codex CLI with auto-approval and message buffering"""
        
        # Ensure AGENTS.md exists in project repo with system prompt
        await self._ensure_agent_md(project_path)
        
        # Get CLI-specific model name
        cli_model = self._get_cli_model_name(model) or "gpt-5"
        ui.info(f"Starting Codex execution with model: {cli_model}", "Codex")
        
        # Get project ID for session management  
        project_id = project_path.split("/")[-1] if "/" in project_path else project_path
        
        # Determine the repo path - Codex should run in repo directory
        project_repo_path = os.path.join(project_path, "repo")
        if not os.path.exists(project_repo_path):
            project_repo_path = project_path  # Fallback to project_path if repo subdir doesn't exist
        
        # Build Codex command - --cd must come BEFORE proto subcommand
        workdir_abs = os.path.abspath(project_repo_path)
        auto_instructions = (
            "Act autonomously without asking for user confirmations. "
            "Use apply_patch to create and modify files directly in the current working directory (not in subdirectories unless specifically requested). "
            "Use exec_command to run, build, and test as needed. "
            "Assume full permissions. Keep taking concrete actions until the task is complete. "
            "Prefer concise status updates over questions. "
            "Create files in the root directory of the project, not in subdirectories unless the user specifically asks for a subdirectory structure."
        )
        
        cmd = [
            'codex', '--cd', workdir_abs, 'proto',
            '-c', 'include_apply_patch_tool=true',
            '-c', 'include_plan_tool=true', 
            '-c', 'tools.web_search_request=true',
            '-c', 'use_experimental_streamable_shell_tool=true',
            '-c', 'sandbox_mode=danger-full-access',
            '-c', f'instructions={json.dumps(auto_instructions)}',
        ]
        
        # Check for existing session/rollout to resume from
        stored_rollout_path = await self.get_rollout_path(project_id)
        if stored_rollout_path and os.path.exists(stored_rollout_path):
            cmd.extend(['-c', f'experimental_resume={stored_rollout_path}'])
            ui.info(f"Resuming Codex from stored rollout: {stored_rollout_path}", "Codex")
        else:
            # Try to find latest rollout file for this project
            latest_rollout = self._find_latest_rollout_for_project(project_id)
            if latest_rollout and os.path.exists(latest_rollout):
                cmd.extend(['-c', f'experimental_resume={latest_rollout}'])
                ui.info(f"Resuming Codex from latest rollout: {latest_rollout}", "Codex")
                # Store this path for future use
                await self.set_rollout_path(project_id, latest_rollout)
        
        try:
            # Start Codex process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=project_repo_path
            )
            
            # Message buffering
            agent_message_buffer = ""
            current_request_id = None
            
            # Wait for session_configured
            session_ready = False
            timeout_count = 0
            max_timeout = 100  # Max lines to read for session init
            
            while not session_ready and timeout_count < max_timeout:
                line = await process.stdout.readline()
                if not line:
                    break
                    
                line_str = line.decode().strip()
                if not line_str:
                    timeout_count += 1
                    continue
                    
                try:
                    event = json.loads(line_str)
                    if event.get("msg", {}).get("type") == "session_configured":
                        session_info = event["msg"]
                        codex_session_id = session_info.get("session_id")
                        if codex_session_id:
                            await self.set_session_id(project_id, codex_session_id)
                        
                        ui.success(f"Codex session configured: {codex_session_id}", "Codex")
                        
                        # Send init message (hidden)
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="system",
                            message_type="system",
                            content=f"🚀 Codex initialized (Model: {session_info.get('model', cli_model)})",
                            metadata_json={
                                "cli_type": self.cli_type.value,
                                "hidden_from_ui": True
                            },
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        
                        # Set approval policy to never (full-auto)
                        await self._set_codex_approval_policy(process, codex_session_id)
                        
                        session_ready = True
                        break
                        
                except json.JSONDecodeError as e:
                    ui.debug(f"JSON parse error during init: {e}", "Codex")
                    timeout_count += 1
                    continue
                    
            if not session_ready:
                ui.error("Failed to initialize Codex session", "Codex")
                return
            
            # Send user input
            request_id = f"msg_{uuid.uuid4().hex[:8]}"
            current_request_id = request_id
            
            # Add project directory context for initial prompts
            final_instruction = instruction
            if is_initial_prompt:
                try:
                    # Get actual files in the project repo directory
                    repo_files = []
                    if os.path.exists(project_repo_path):
                        for item in os.listdir(project_repo_path):
                            if not item.startswith('.git') and item != 'AGENTS.md':
                                repo_files.append(item)
                    
                    if repo_files:
                        project_context = f"""

<current_project_context>
Current files in project directory: {', '.join(sorted(repo_files))}
Work directly in the current directory. Do not create subdirectories unless specifically requested.
</current_project_context>"""
                        final_instruction = instruction + project_context
                        ui.info(f"Added current project files context to Codex", "Codex")
                    else:
                        project_context = """

<current_project_context>
This is an empty project directory. Create files directly in the current working directory.
Do not create subdirectories unless specifically requested by the user.
</current_project_context>"""
                        final_instruction = instruction + project_context
                        ui.info(f"Added empty project context to Codex", "Codex")
                except Exception as e:
                    ui.warning(f"Failed to add project context: {e}", "Codex")
            
            # Build instruction with image references
            if images:
                image_refs = []
                for i in range(len(images)):
                    image_refs.append(f"[Image #{i+1}]")
                image_context = f"\n\nI've attached {len(images)} image(s) for you to analyze: {', '.join(image_refs)}"
                final_instruction_with_images = final_instruction + image_context
            else:
                final_instruction_with_images = final_instruction
            
            items = [{"type": "text", "text": final_instruction_with_images}]
            
            # Add images if provided
            if images:
                import base64 as _b64
                import tempfile as _tmp

                def _iget(obj, key, default=None):
                    try:
                        if isinstance(obj, dict):
                            return obj.get(key, default)
                        return getattr(obj, key, default)
                    except Exception:
                        return default

                for i, image_data in enumerate(images):
                    # Support direct local path
                    local_path = _iget(image_data, "path")
                    if local_path:
                        ui.info(f"📷 Image #{i+1} path sent to Codex: {local_path}", "Codex")
                        items.append({"type": "local_image", "path": str(local_path)})
                        continue

                    # Support base64 via either 'base64_data' or legacy 'data'
                    b64_str = _iget(image_data, "base64_data") or _iget(image_data, "data")
                    # Or a data URL in 'url'
                    if not b64_str:
                        url_val = _iget(image_data, "url")
                        if isinstance(url_val, str) and url_val.startswith("data:") and "," in url_val:
                            b64_str = url_val.split(",", 1)[1]

                    if b64_str:
                        try:
                            # Optional size guard (~3/4 of base64 length)
                            approx_bytes = int(len(b64_str) * 0.75)
                            if approx_bytes > 10 * 1024 * 1024:
                                ui.warning("Skipping image >10MB", "Codex")
                                continue

                            img_bytes = _b64.b64decode(b64_str, validate=False)
                            mime_type = _iget(image_data, "mime_type") or "image/png"
                            suffix = ".png"
                            if "jpeg" in mime_type or "jpg" in mime_type:
                                suffix = ".jpg"
                            elif "gif" in mime_type:
                                suffix = ".gif"
                            elif "webp" in mime_type:
                                suffix = ".webp"

                            with _tmp.NamedTemporaryFile(delete=False, suffix=suffix) as tmpf:
                                tmpf.write(img_bytes)
                                ui.info(f"📷 Image #{i+1} saved to temporary path: {tmpf.name}", "Codex")
                                items.append({"type": "local_image", "path": tmpf.name})
                        except Exception as e:
                            ui.warning(f"Failed to decode attached image: {e}", "Codex")
            
            # Send to Codex
            user_input = {
                "id": request_id,
                "op": {
                    "type": "user_input",
                    "items": items
                }
            }
            
            if process.stdin:
                json_str = json.dumps(user_input)
                process.stdin.write(json_str.encode('utf-8') + b'\n')
                await process.stdin.drain()
                
                # Log items being sent to agent
                if images and len(items) > 1:
                    ui.debug(f"Sending {len(items)} items to Codex (1 text + {len(items)-1} images)", "Codex")
                    for item in items:
                        if item.get("type") == "local_image":
                            ui.debug(f"  - Image: {item.get('path')}", "Codex")
                
                ui.debug(f"Sent user input: {request_id}", "Codex")
            
            # Process streaming events
            async for line in process.stdout:
                line_str = line.decode().strip()
                if not line_str:
                    continue
                    
                try:
                    event = json.loads(line_str)
                    event_id = event.get("id", "")
                    msg_type = event.get("msg", {}).get("type")
                    
                    # Only process events for current request (exclude system events)
                    if (current_request_id and event_id != current_request_id and 
                        msg_type not in ["session_configured", "mcp_list_tools_response"]):
                        continue
                    
                    # Buffer agent message deltas
                    if msg_type == "agent_message_delta":
                        agent_message_buffer += event["msg"]["delta"]
                        continue
                    
                    # Only flush buffered assistant text on final assistant message or at task completion.
                    # This avoids creating multiple assistant bubbles separated by tool events.
                    if msg_type == "agent_message":
                        # If Codex sent a final message without deltas, use it directly
                        if not agent_message_buffer:
                            try:
                                final_msg = event.get("msg", {}).get("message")
                                if isinstance(final_msg, str) and final_msg:
                                    agent_message_buffer = final_msg
                            except Exception:
                                pass
                        if not agent_message_buffer:
                            # Nothing to flush
                            continue
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="chat",
                            content=agent_message_buffer,
                            metadata_json={"cli_type": self.cli_type.value},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        agent_message_buffer = ""
                    
                    # Handle specific events
                    if msg_type == "exec_command_begin":
                        cmd_str = " ".join(event["msg"]["command"])
                        summary = self._create_tool_summary("exec_command", {"command": cmd_str})
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="tool_use",
                            content=summary,
                            metadata_json={"cli_type": self.cli_type.value, "tool_name": "Bash"},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        
                    elif msg_type == "patch_apply_begin":
                        changes = event["msg"].get("changes", {})
                        ui.debug(f"Patch apply begin - changes: {changes}", "Codex")
                        summary = self._create_tool_summary("apply_patch", {"changes": changes})
                        ui.debug(f"Generated summary: {summary}", "Codex")
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="tool_use",
                            content=summary,
                            metadata_json={"cli_type": self.cli_type.value, "tool_name": "Edit"},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        
                    elif msg_type == "web_search_begin":
                        query = event["msg"].get("query", "")
                        summary = self._create_tool_summary("web_search", {"query": query})
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="tool_use",
                            content=summary,
                            metadata_json={"cli_type": self.cli_type.value, "tool_name": "WebSearch"},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        
                    elif msg_type == "mcp_tool_call_begin":
                        inv = event["msg"].get("invocation", {})
                        server = inv.get("server")
                        tool = inv.get("tool")
                        summary = self._create_tool_summary("mcp_tool_call", {"server": server, "tool": tool})
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="tool_use",
                            content=summary,
                            metadata_json={"cli_type": self.cli_type.value, "tool_name": "MCPTool"},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                    
                    elif msg_type in ["exec_command_output_delta"]:
                        # Output chunks from command execution - can be ignored for UI
                        pass
                        
                    elif msg_type in ["exec_command_end", "patch_apply_end", "mcp_tool_call_end"]:
                        # Tool completion events - just log, don't show to user
                        ui.debug(f"Tool completed: {msg_type}", "Codex")
                        
                    elif msg_type == "task_complete":
                        # Flush any remaining message buffer before completing
                        if agent_message_buffer:
                            yield Message(
                                id=str(uuid.uuid4()),
                                project_id=project_path,
                                role="assistant",
                                message_type="chat",
                                content=agent_message_buffer,
                                metadata_json={"cli_type": self.cli_type.value},
                                session_id=session_id,
                                created_at=datetime.utcnow()
                            )
                            agent_message_buffer = ""
                        
                        # Task completion - save rollout file path for future resumption
                        ui.success("Codex task completed", "Codex")
                        
                        # Find and store the latest rollout file for this session
                        try:
                            latest_rollout = self._find_latest_rollout_for_project(project_id)
                            if latest_rollout:
                                await self.set_rollout_path(project_id, latest_rollout)
                                ui.debug(f"Saved rollout path for future resumption: {latest_rollout}", "Codex")
                        except Exception as e:
                            ui.warning(f"Failed to save rollout path: {e}", "Codex")
                        
                        break
                        
                    elif msg_type == "error":
                        error_msg = event["msg"]["message"]
                        ui.error(f"Codex error: {error_msg}", "Codex")
                        yield Message(
                            id=str(uuid.uuid4()),
                            project_id=project_path,
                            role="assistant",
                            message_type="error",
                            content=f"❌ Error: {error_msg}",
                            metadata_json={"cli_type": self.cli_type.value},
                            session_id=session_id,
                            created_at=datetime.utcnow()
                        )
                        
                    # Removed duplicate agent_message handler - already handled above
                    
                except json.JSONDecodeError:
                    continue
            
            # Flush any remaining buffer
            if agent_message_buffer:
                yield Message(
                    id=str(uuid.uuid4()),
                    project_id=project_path,
                    role="assistant",
                    message_type="chat",
                    content=agent_message_buffer,
                    metadata_json={"cli_type": self.cli_type.value},
                    session_id=session_id,
                    created_at=datetime.utcnow()
                )
            
            # Clean shutdown
            if process.stdin:
                try:
                    shutdown_cmd = {"id": "shutdown", "op": {"type": "shutdown"}}
                    json_str = json.dumps(shutdown_cmd)
                    process.stdin.write(json_str.encode('utf-8') + b'\n')
                    await process.stdin.drain()
                    process.stdin.close()
                    ui.debug("Sent shutdown command to Codex", "Codex")
                except Exception as e:
                    ui.debug(f"Failed to send shutdown: {e}", "Codex")
            
            await process.wait()
            
        except FileNotFoundError:
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content="❌ Codex CLI not found. Please install Codex CLI first.",
                metadata_json={"error": "cli_not_found", "cli_type": "codex"},
                session_id=session_id,
                created_at=datetime.utcnow()
            )
        except Exception as e:
            yield Message(
                id=str(uuid.uuid4()),
                project_id=project_path,
                role="assistant",
                message_type="error",
                content=f"❌ Codex execution failed: {str(e)}",
                metadata_json={"error": "execution_failed", "cli_type": "codex"},
                session_id=session_id,
                created_at=datetime.utcnow()
            )
    
    async def get_session_id(self, project_id: str) -> Optional[str]:
        """Get stored session ID for project"""
        # Try to get from database first
        if self.db_session:
            try:
                from app.models.projects import Project
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project and project.active_cursor_session_id:
                    # Parse JSON data that might contain codex session info
                    try:
                        session_data = json.loads(project.active_cursor_session_id)
                        if isinstance(session_data, dict) and "codex" in session_data:
                            codex_session = session_data["codex"]
                            ui.debug(f"Retrieved Codex session from DB: {codex_session}", "Codex")
                            return codex_session
                    except (json.JSONDecodeError, TypeError):
                        # If it's not JSON, might be a plain cursor session ID
                        pass
            except Exception as e:
                ui.warning(f"Failed to get Codex session from DB: {e}", "Codex")
        
        # Fallback to memory storage
        return self._session_store.get(project_id)
    
    async def set_session_id(self, project_id: str, session_id: str) -> None:
        """Store session ID for project with database persistence"""
        # Store in database
        if self.db_session:
            try:
                from app.models.projects import Project
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project:
                    # Try to parse existing session data
                    existing_data = {}
                    if project.active_cursor_session_id:
                        try:
                            existing_data = json.loads(project.active_cursor_session_id)
                            if not isinstance(existing_data, dict):
                                # If it's a plain string, preserve it as cursor session
                                existing_data = {"cursor": project.active_cursor_session_id}
                        except (json.JSONDecodeError, TypeError):
                            existing_data = {"cursor": project.active_cursor_session_id}
                    
                    # Add/update codex session
                    existing_data["codex"] = session_id
                    
                    # Save back to database
                    project.active_cursor_session_id = json.dumps(existing_data)
                    self.db_session.commit()
                    ui.debug(f"Codex session saved to DB for project {project_id}: {session_id}", "Codex")
            except Exception as e:
                ui.error(f"Failed to save Codex session to DB: {e}", "Codex")
        
        # Store in memory as fallback
        self._session_store[project_id] = session_id
        ui.debug(f"Codex session stored in memory for project {project_id}: {session_id}", "Codex")
    
    async def get_rollout_path(self, project_id: str) -> Optional[str]:
        """Get stored rollout file path for project"""
        if self.db_session:
            try:
                from app.models.projects import Project
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project and project.active_cursor_session_id:
                    try:
                        session_data = json.loads(project.active_cursor_session_id)
                        if isinstance(session_data, dict) and "codex_rollout" in session_data:
                            rollout_path = session_data["codex_rollout"]
                            ui.debug(f"Retrieved Codex rollout path from DB: {rollout_path}", "Codex")
                            return rollout_path
                    except (json.JSONDecodeError, TypeError):
                        pass
            except Exception as e:
                ui.warning(f"Failed to get Codex rollout path from DB: {e}", "Codex")
        return None
    
    async def set_rollout_path(self, project_id: str, rollout_path: str) -> None:
        """Store rollout file path for project"""
        if self.db_session:
            try:
                from app.models.projects import Project
                project = self.db_session.query(Project).filter(Project.id == project_id).first()
                if project:
                    # Try to parse existing session data
                    existing_data = {}
                    if project.active_cursor_session_id:
                        try:
                            existing_data = json.loads(project.active_cursor_session_id)
                            if not isinstance(existing_data, dict):
                                existing_data = {"cursor": project.active_cursor_session_id}
                        except (json.JSONDecodeError, TypeError):
                            existing_data = {"cursor": project.active_cursor_session_id}
                    
                    # Add/update rollout path
                    existing_data["codex_rollout"] = rollout_path
                    
                    # Save back to database
                    project.active_cursor_session_id = json.dumps(existing_data)
                    self.db_session.commit()
                    ui.debug(f"Codex rollout path saved to DB for project {project_id}: {rollout_path}", "Codex")
            except Exception as e:
                ui.error(f"Failed to save Codex rollout path to DB: {e}", "Codex")
    
    def _find_latest_rollout_for_project(self, project_id: str) -> Optional[str]:
        """Find the latest rollout file using codex_chat.py logic"""
        try:
            from pathlib import Path
            
            # Use exact same logic as codex_chat.py _resolve_resume_path for "latest"
            root = Path.home() / ".codex" / "sessions"
            if not root.exists():
                ui.debug(f"Codex sessions directory does not exist: {root}", "Codex")
                return None
            
            # Find all rollout files using same pattern as codex_chat.py
            candidates = sorted(
                root.rglob("rollout-*.jsonl"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,  # Most recent first
            )
            
            if not candidates:
                ui.debug(f"No rollout files found in {root}", "Codex")
                return None
            
            # Return the most recent file (same as codex_chat.py "latest" logic)
            latest_file = candidates[0]
            rollout_path = str(latest_file.resolve())
            
            ui.debug(f"Found latest rollout file for project {project_id}: {rollout_path}", "Codex")
            return rollout_path
        except Exception as e:
            ui.warning(f"Failed to find latest rollout file: {e}", "Codex")
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
            ui.debug(f"AGENTS.md already exists at: {agent_md_path}", "Codex")
            return
        
        try:
            # Read system prompt from the source file using relative path
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            # unified_manager.py is in: app/services/cli/
            # Navigate: cli -> services -> app
            app_dir = os.path.join(current_file_dir, "..", "..")
            app_dir = os.path.abspath(app_dir)
            system_prompt_path = os.path.join(app_dir, "prompt", "system-prompt.md")
            
            if os.path.exists(system_prompt_path):
                with open(system_prompt_path, 'r', encoding='utf-8') as f:
                    system_prompt_content = f.read()
                
                # Write to AGENTS.md in the project repo
                with open(agent_md_path, 'w', encoding='utf-8') as f:
                    f.write(system_prompt_content)
                
                ui.success(f"Created AGENTS.md at: {agent_md_path}", "Codex")
            else:
                ui.warning(f"System prompt file not found at: {system_prompt_path}", "Codex")
        except Exception as e:
            ui.error(f"Failed to create AGENTS.md: {e}", "Codex")

    async def _set_codex_approval_policy(self, process, session_id: str):
        """Set Codex approval policy to never (full-auto mode)"""
        try:
            ctl_id = f"ctl_{uuid.uuid4().hex[:8]}"
            payload = {
                "id": ctl_id,
                "op": {
                    "type": "override_turn_context",
                    "approval_policy": "never",
                    "sandbox_policy": {"mode": "danger-full-access"},
                },
            }
            
            if process.stdin:
                json_str = json.dumps(payload)
                process.stdin.write(json_str.encode('utf-8') + b'\n')
                await process.stdin.drain()
                ui.success("Codex approval policy set to auto-approve", "Codex")
        except Exception as e:
            ui.error(f"Failed to set approval policy: {e}", "Codex")





class UnifiedCLIManager:
    """Unified manager for all CLI implementations"""
    
    def __init__(
        self,
        project_id: str,
        project_path: str,
        session_id: str,
        conversation_id: str,
        db: Any  # SQLAlchemy Session
    ):
        self.project_id = project_id
        self.project_path = project_path
        self.session_id = session_id
        self.conversation_id = conversation_id
        self.db = db
        
        # Initialize CLI adapters with database session
        self.cli_adapters = {
            CLIType.CLAUDE: ClaudeCodeCLI(),  # Use SDK implementation if available
            CLIType.CURSOR: CursorAgentCLI(db_session=db),
            CLIType.CODEX: CodexCLI(db_session=db)
        }
    
    async def execute_instruction(
        self,
        instruction: str,
        cli_type: CLIType,
        fallback_enabled: bool = True,  # Kept for backward compatibility but not used
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False
    ) -> Dict[str, Any]:
        """Execute instruction with specified CLI"""
        
        # Try the specified CLI
        if cli_type in self.cli_adapters:
            cli = self.cli_adapters[cli_type]
            
            # Check if CLI is available
            status = await cli.check_availability()
            if status.get("available") and status.get("configured"):
                try:
                    return await self._execute_with_cli(
                        cli, instruction, images, model, is_initial_prompt
                    )
                except Exception as e:
                    ui.error(f"CLI {cli_type.value} failed: {e}", "CLI")
                    return {
                        "success": False,
                        "error": str(e),
                        "cli_attempted": cli_type.value
                    }
            else:
                return {
                    "success": False,
                    "error": status.get("error", "CLI not available"),
                    "cli_attempted": cli_type.value
                }
        
        return {
            "success": False,
            "error": f"CLI type {cli_type.value} not implemented",
            "cli_attempted": cli_type.value
        }
    
    async def _execute_with_cli(
        self,
        cli,
        instruction: str,
        images: Optional[List[Dict[str, Any]]],
        model: Optional[str] = None,
        is_initial_prompt: bool = False
    ) -> Dict[str, Any]:
        """Execute instruction with a specific CLI"""
        
        ui.info(f"Starting {cli.cli_type.value} execution", "CLI")
        if model:
            ui.debug(f"Using model: {model}", "CLI")
        
        messages_collected = []
        has_changes = False
        has_error = False  # Track if any error occurred
        result_success = None  # Track result event success status
        
        # Log callback
        async def log_callback(message: str):
            # CLI output logs are now only printed to console, not sent to UI
            pass
        
        message_count = 0
        
        async for message in cli.execute_with_streaming(
            instruction=instruction,
            project_path=self.project_path,
            session_id=self.session_id,
            log_callback=log_callback,
            images=images,
            model=model,
            is_initial_prompt=is_initial_prompt
        ):
            message_count += 1
            
            # Check for error messages or result status
            if message.message_type == "error":
                has_error = True
                ui.error(f"CLI error detected: {message.content[:100]}", "CLI")
            
            # Check for Cursor result event (stored in metadata)
            if message.metadata_json:
                event_type = message.metadata_json.get("event_type")
                original_event = message.metadata_json.get("original_event", {})
                
                if event_type == "result" or original_event.get("type") == "result":
                    # Cursor sends result event with success/error status
                    is_error = original_event.get("is_error", False)
                    subtype = original_event.get("subtype", "")
                    
                    # ★ DEBUG: Log the complete result event structure
                    ui.info(f"🔍 [Cursor] Result event received:", "DEBUG")
                    ui.info(f"   Full event: {original_event}", "DEBUG")
                    ui.info(f"   is_error: {is_error}", "DEBUG")
                    ui.info(f"   subtype: '{subtype}'", "DEBUG")
                    ui.info(f"   has event.result: {'result' in original_event}", "DEBUG")
                    ui.info(f"   has event.status: {'status' in original_event}", "DEBUG")
                    ui.info(f"   has event.success: {'success' in original_event}", "DEBUG")
                    
                    if is_error or subtype == "error":
                        has_error = True
                        result_success = False
                        ui.error(f"Cursor result: error (is_error={is_error}, subtype='{subtype}')", "CLI")
                    elif subtype == "success":
                        result_success = True
                        ui.success(f"Cursor result: success (subtype='{subtype}')", "CLI")
                    else:
                        # ★ NEW: Handle case where subtype is not "success" but execution was successful
                        ui.warning(f"Cursor result: no explicit success subtype (subtype='{subtype}', is_error={is_error})", "CLI")
                        # If there's no error indication, assume success
                        if not is_error:
                            result_success = True
                            ui.success(f"Cursor result: assuming success (no error detected)", "CLI")
            
            # Save message to database
            message.project_id = self.project_id
            message.conversation_id = self.conversation_id
            self.db.add(message)
            self.db.commit()
            
            messages_collected.append(message)
            
            # Check if message should be hidden from UI
            should_hide = message.metadata_json and message.metadata_json.get("hidden_from_ui", False)
            
            # Send message via WebSocket only if not hidden
            if not should_hide:
                ws_message = {
                    "type": "message",
                    "data": {
                        "id": message.id,
                        "role": message.role,
                        "message_type": message.message_type,
                        "content": message.content,
                        "metadata": message.metadata_json,
                        "parent_message_id": getattr(message, 'parent_message_id', None),
                        "session_id": message.session_id,
                        "conversation_id": self.conversation_id,
                        "created_at": message.created_at.isoformat()
                    },
                    "timestamp": message.created_at.isoformat()
                }
                try:
                    await ws_manager.send_message(self.project_id, ws_message)
                except Exception as e:
                    ui.error(f"WebSocket send failed: {e}", "Message")
            
            # Check if changes were made
            if message.metadata_json and "changes_made" in message.metadata_json:
                has_changes = True
        
        # Determine final success status
        # For Cursor: check result_success if available, otherwise check has_error
        # For Claude: check has_error
        ui.info(f"🔍 Final success determination: cli_type={cli.cli_type}, result_success={result_success}, has_error={has_error}", "CLI")
        
        if cli.cli_type == CLIType.CURSOR and result_success is not None:
            success = result_success
            ui.info(f"Using Cursor result_success: {result_success}", "CLI")
        else:
            success = not has_error
            ui.info(f"Using has_error logic: not {has_error} = {success}", "CLI")
        
        if success:
            ui.success(f"Streaming completed successfully. Total messages: {len(messages_collected)}", "CLI")
        else:
            ui.error(f"Streaming completed with errors. Total messages: {len(messages_collected)}", "CLI")
        
        return {
            "success": success,
            "cli_used": cli.cli_type.value,
            "has_changes": has_changes,
            "message": f"{'Successfully' if success else 'Failed to'} execute with {cli.cli_type.value}",
            "error": "Execution failed" if not success else None,
            "messages_count": len(messages_collected)
        }
    
    async def check_cli_status(self, cli_type: CLIType, selected_model: Optional[str] = None) -> Dict[str, Any]:
        """Check status of a specific CLI"""
        if cli_type in self.cli_adapters:
            status = await self.cli_adapters[cli_type].check_availability()
            
            # Add model validation if model is specified
            if selected_model and status.get("available"):
                cli = self.cli_adapters[cli_type]
                if not cli.is_model_supported(selected_model):
                    status["model_warning"] = f"Model '{selected_model}' may not be supported by {cli_type.value}"
                    status["suggested_models"] = status.get("default_models", [])
                else:
                    status["selected_model"] = selected_model
                    status["model_valid"] = True
            
            return status
        return {
            "available": False,
            "configured": False,
            "error": f"CLI type {cli_type.value} not implemented"
        }
