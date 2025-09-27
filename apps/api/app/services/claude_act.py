import os
from typing import Tuple, Optional, Callable
import json
from datetime import datetime
from pathlib import Path

try:
    from claude_code_sdk import query, ClaudeCodeOptions
except ImportError:
    # SDK might be updating, provide fallback
    query = None
    ClaudeCodeOptions = None
try:
    from claude_code_sdk.types import (
        Message, UserMessage, AssistantMessage, SystemMessage, ResultMessage,
        ContentBlock, TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock
    )
except ImportError:
    # SDK types might be missing, provide None fallback
    Message = UserMessage = AssistantMessage = SystemMessage = ResultMessage = None
    ContentBlock = TextBlock = ThinkingBlock = ToolUseBlock = ToolResultBlock = None


DEFAULT_MODEL = os.getenv("CLAUDE_CODE_MODEL", "claude-sonnet-4-20250514")


def find_prompt_file() -> Path:
    """
    Find the system-prompt.md file in app/prompt/ directory.
    """
    current_path = Path(__file__).resolve()
    
    # Get the app directory (current file is in app/services/)
    app_dir = current_path.parent.parent  # app/
    prompt_file = app_dir / 'prompt' / 'system-prompt.md'
    
    if prompt_file.exists():
        return prompt_file
    
    # Fallback: look for system-prompt.md in various locations
    fallback_locations = [
        current_path.parent.parent / 'prompt' / 'system-prompt.md',  # app/prompt/
        current_path.parent.parent.parent.parent / 'docs' / 'system-prompt.md',  # project-root/docs/
        current_path.parent.parent.parent.parent / 'system-prompt.md',  # project-root/
    ]
    
    for location in fallback_locations:
        if location.exists():
            return location
    
    # Return expected location even if it doesn't exist
    return prompt_file


def load_system_prompt(force_reload: bool = False) -> str:
    """
    Load system prompt from app/prompt/system-prompt.md file.
    Falls back to basic prompt if file not found.
    
    Args:
        force_reload: If True, ignores cache and reloads from file
    """
    # Simple caching mechanism
    if not force_reload and hasattr(load_system_prompt, '_cached_prompt'):
        return load_system_prompt._cached_prompt
    
    try:
        prompt_file = find_prompt_file()
        
        if prompt_file.exists():
            with open(prompt_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                print(f"✅ Loaded system prompt from: {prompt_file} ({len(content)} chars)")
                
                # Cache the loaded prompt
                load_system_prompt._cached_prompt = content
                return content
        else:
            print(f"⚠️  System prompt file not found at: {prompt_file}")
            
    except Exception as e:
        print(f"❌ Error loading system prompt: {e}")
        import traceback
        traceback.print_exc()
    
    # Fallback to basic prompt
    fallback_prompt = (
        "You are Claude Code, an advanced AI coding assistant specialized in building modern fullstack web applications.\n"
        "You assist users by chatting with them and making changes to their code in real-time.\n\n"
        "Constraints:\n"
        "- Do not delete files entirely; prefer edits.\n"
        "- Keep changes minimal and focused.\n"
        "- Use UTF-8 encoding.\n"
        "- Follow modern development best practices.\n"
    )
    
    print(f"🔄 Using fallback system prompt ({len(fallback_prompt)} chars)")
    load_system_prompt._cached_prompt = fallback_prompt
    return fallback_prompt


def get_system_prompt() -> str:
    """Get the current system prompt (uses cached version)"""
    return load_system_prompt(force_reload=False)


def get_initial_system_prompt() -> str:
    """Get the initial system prompt for project creation (uses cached version)"""
    return load_system_prompt(force_reload=False)


# System prompt is now loaded dynamically via get_system_prompt() and get_initial_system_prompt()


# Legacy functions removed - now only generate_diff_with_logging is used


def extract_tool_summary(tool_name: str, tool_input: dict) -> str:
    """Extract concise summary for tool usage"""
    if tool_name == "Read":
        return f"📖 Reading: {tool_input.get('file_path', 'unknown')}"
    elif tool_name == "Write":
        return f"✏️ Writing: {tool_input.get('file_path', 'unknown')}"
    elif tool_name == "Edit":
        return f"🔧 Editing: {tool_input.get('file_path', 'unknown')}"
    elif tool_name == "MultiEdit":
        return f"🔧 Multi-editing: {tool_input.get('file_path', 'unknown')}"
    elif tool_name == "Bash":
        cmd = tool_input.get('command', '')
        return f"💻 Running: {cmd[:50]}{'...' if len(cmd) > 50 else ''}"
    elif tool_name == "Glob":
        return f"🔍 Searching: {tool_input.get('pattern', 'unknown')}"
    elif tool_name == "Grep":
        return f"🔎 Grep: {tool_input.get('pattern', 'unknown')}"
    elif tool_name == "LS":
        return f"📁 Listing: {tool_input.get('path', 'current dir')}"
    elif tool_name == "WebFetch":
        return f"🌐 Fetching: {tool_input.get('url', 'unknown')}"
    elif tool_name == "TodoWrite":
        return f"📝 Managing todos"
    else:
        return f"🔧 {tool_name}: {list(tool_input.keys())[:3]}"


async def generate_diff_with_logging(
    instruction: str, 
    allow_globs: list[str], 
    repo_path: str,
    log_callback: Optional[Callable] = None,
    resume_session_id: Optional[str] = None,
    system_prompt: str = None
) -> Tuple[str, str, Optional[str]]:
    """
    Generate diff with real-time logging via callback function.
    
    Args:
        instruction: Task description
        allow_globs: List of allowed file patterns
        repo_path: Repository path
        log_callback: Async function to call with log data
        resume_session_id: Optional Claude Code session ID to resume
        system_prompt: Custom system prompt (defaults to get_system_prompt())
    
    Returns:
        Tuple of (commit_message, changes_summary, session_id)
    """
    # Claude Code SDK can work without API key in local mode
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Note: Running Claude Code SDK in local mode (no API key)")
    
    # Build a simple, direct prompt  
    user_prompt = (
        f"Task: {instruction}\n\n"
        "Please implement the requested changes to this Next.js project. "
        "After making changes, provide a summary in this format:\n"
        "<COMMIT_MSG>One-line imperative commit message</COMMIT_MSG>\n"
        "<SUMMARY>Brief description of changes made</SUMMARY>"
    )
    
    # Use provided system prompt or default (dynamically loaded)
    effective_system_prompt = system_prompt if system_prompt is not None else get_system_prompt()
    
    # Setup Claude Code options with session resumption
    options = ClaudeCodeOptions(
        cwd=repo_path,
        allowed_tools=["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS"],
        permission_mode='acceptEdits',
        system_prompt=effective_system_prompt,
        model=DEFAULT_MODEL,  # Use Claude 4 Sonnet model
        resume=resume_session_id  # Resume existing session if provided
    )
    
    response_text = ""
    messages_received = []
    pending_tools = {}  # Track tool use/result pairs
    current_session_id = None  # Track the current Claude Code session ID
    
    start_time = datetime.now()
    
    try:
        print(f"Starting Claude Code SDK query with prompt: {user_prompt[:100]}...")
        message_count = 0
        
        # Add immediate debug message to test real-time transmission
        if log_callback:
            await log_callback("text", {"content": "🚀 Starting Claude Code execution..."})
        
        async for message in query(prompt=user_prompt, options=options):
            messages_received.append(message)
            message_count += 1
            print(f"Received message #{message_count} type: {type(message).__name__}")
            
            # Skip internal debug messages to avoid cluttering the UI
            
            # Log different message types
            if isinstance(message, SystemMessage):
                # Skip system init messages - they're not useful for users
                if message.subtype == "init":
                    continue
                    
            elif isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        response_text += block.text
                        if log_callback:
                            await log_callback("text", {"content": block.text})
                            
                    elif isinstance(block, ThinkingBlock):
                        if log_callback:
                            await log_callback("thinking", {
                                "content": block.thinking[:200] + "..." if len(block.thinking) > 200 else block.thinking
                            })
                            
                    elif isinstance(block, ToolUseBlock):
                        pending_tools[block.id] = {
                            "name": block.name,
                            "input": block.input,
                            "summary": extract_tool_summary(block.name, block.input)
                        }
                        if log_callback:
                            await log_callback("tool_start", {
                                "tool_id": block.id,
                                "tool_name": block.name,
                                "summary": pending_tools[block.id]["summary"],
                                "input": block.input
                            })
                            
                    elif isinstance(block, ToolResultBlock):
                        tool_info = pending_tools.get(block.tool_use_id, {})
                        if log_callback:
                            # For Edit operations, try to extract diff-like information
                            diff_info = None
                            if tool_info.get("name") in ["Edit", "MultiEdit"] and block.content:
                                try:
                                    content_str = str(block.content)
                                    if "updated" in content_str.lower() or "modified" in content_str.lower():
                                        diff_info = content_str
                                except:
                                    pass
                            
                            await log_callback("tool_result", {
                                "tool_id": block.tool_use_id,
                                "tool_name": tool_info.get("name", "unknown"),
                                "summary": tool_info.get("summary", "Tool completed"),
                                "is_error": block.is_error or False,
                                "content": str(block.content)[:500] if block.content else None,
                                "diff_info": diff_info
                            })
                        
                        # Clean up pending tools
                        pending_tools.pop(block.tool_use_id, None)
                        
            elif isinstance(message, ResultMessage):
                # Extract session ID from ResultMessage
                if hasattr(message, 'session_id') and message.session_id:
                    current_session_id = message.session_id
                    print(f"Extracted Claude Code session ID: {current_session_id}")
                
                duration_ms = (datetime.now() - start_time).total_seconds() * 1000
                if log_callback:
                    await log_callback("result", {
                        "duration_ms": int(duration_ms),
                        "api_duration_ms": message.duration_api_ms,
                        "turns": message.num_turns,
                        "total_cost_usd": message.total_cost_usd,
                        "is_error": message.is_error,
                        "session_id": current_session_id
                    })
                    
    except Exception as exc:
        print(f"Claude Code SDK exception: {type(exc).__name__}: {exc}")
        if log_callback:
            await log_callback("error", {"message": str(exc)})
        raise RuntimeError(f"Claude Code SDK execution failed: {exc}") from exc
    
    print(f"Claude Code SDK completed. Received {message_count} messages.")
    
    # If no messages were received, Claude Code SDK might not be working properly
    if message_count == 0:
        print("No messages received from Claude Code SDK - falling back to simple response")
        response_text = f"I understand you want to: {instruction}\n\nHowever, Claude Code SDK is not fully configured. Please check if Claude Code CLI is installed or set up your ANTHROPIC_API_KEY."
    
    # Extract commit message and summary
    commit_msg = ""
    if "<COMMIT_MSG>" in response_text and "</COMMIT_MSG>" in response_text:
        commit_msg = response_text.split("<COMMIT_MSG>", 1)[1].split("</COMMIT_MSG>", 1)[0].strip()
    
    if not commit_msg:
        commit_msg = instruction.strip()[:72]
    
    diff_summary = "Changes applied directly via Claude Code SDK"
    if "<SUMMARY>" in response_text and "</SUMMARY>" in response_text:
        diff_summary = response_text.split("<SUMMARY>", 1)[1].split("</SUMMARY>", 1)[0].strip()
    
    # Return session ID for conversation continuity
    return commit_msg, diff_summary, current_session_id
