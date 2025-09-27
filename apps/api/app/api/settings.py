import subprocess
import asyncio
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.cli.unified_manager import CursorAgentCLI
from app.services.cli.base import CLIType

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Define CLI options and check commands
CLI_OPTIONS = [
    {
        "id": "claude",
        "name": "Claude Code", 
        "check_command": ["claude", "--version"]
    },
    {
        "id": "cursor",
        "name": "Cursor Agent",
        "check_command": ["cursor-agent", "--version"]
    },
]

class CLIStatusResponse(BaseModel):
    cli_id: str
    installed: bool
    version: str | None = None
    error: str | None = None


async def check_cli_installation(cli_id: str, command: list) -> CLIStatusResponse:
    """Check the installation status of a single CLI."""
    try:
        # Run subprocess asynchronously
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            # Successfully executed
            version_output = stdout.decode().strip()
            # Extract actual version number from version info (use first line only)
            version = version_output.split('\n')[0] if version_output else "installed"
            
            return CLIStatusResponse(
                cli_id=cli_id,
                installed=True,
                version=version
            )
        else:
            # Command executed but returned error code
            error_msg = stderr.decode().strip() if stderr else f"Command failed with code {process.returncode}"
            return CLIStatusResponse(
                cli_id=cli_id,
                installed=False,
                error=error_msg
            )
            
    except FileNotFoundError:
        # Command not found (not installed)
        return CLIStatusResponse(
            cli_id=cli_id,
            installed=False,
            error="Command not found"
        )
    except Exception as e:
        # Other exceptions
        return CLIStatusResponse(
            cli_id=cli_id,
            installed=False,
            error=str(e)
        )


@router.get("/cli-status")
async def get_cli_status() -> Dict[str, Any]:
    """Check and return the installation status of all CLIs."""
    results = {}
    
    # Use CLI instances from the new UnifiedCLIManager
    from app.services.cli.unified_manager import ClaudeCodeCLI, CursorAgentCLI, CodexCLI, QwenCLI, GeminiCLI
    cli_instances = {
        "claude": ClaudeCodeCLI(),
        "cursor": CursorAgentCLI(),
        "codex": CodexCLI(),
        "qwen": QwenCLI(),
        "gemini": GeminiCLI()
    }
    
    # Check all CLIs in parallel
    tasks = []
    for cli_id, cli_instance in cli_instances.items():
        print(f"[DEBUG] Setting up check for CLI: {cli_id}")
        async def check_cli(cli_id, cli_instance):
            print(f"[DEBUG] Checking CLI: {cli_id}")
            status = await cli_instance.check_availability()
            print(f"[DEBUG] CLI {cli_id} status: {status}")
            return cli_id, status
        
        tasks.append(check_cli(cli_id, cli_instance))
    
    # Execute all tasks
    cli_results = await asyncio.gather(*tasks)
    
    # Convert results to dictionary
    for cli_id, status in cli_results:
        results[cli_id] = {
            "installed": status.get("available", False) and status.get("configured", False),
            "version": status.get("models", ["Unknown"])[0] if status.get("models") else None,
            "error": status.get("error"),
            "checking": False
        }
    
    return results


# Temporary memory storage for global settings management (should be stored in database in production)
GLOBAL_SETTINGS = {
    "default_cli": "claude",
    "cli_settings": {
        "claude": {"model": "claude-sonnet-4"},
        "cursor": {"model": "gpt-5"}
    }
}

class GlobalSettingsModel(BaseModel):
    default_cli: str
    cli_settings: Dict[str, Any]


@router.get("/global")
async def get_global_settings() -> Dict[str, Any]:
    """Return global settings."""
    return GLOBAL_SETTINGS


@router.put("/global")
async def update_global_settings(settings: GlobalSettingsModel) -> Dict[str, Any]:
    """Update global settings."""
    global GLOBAL_SETTINGS
    
    GLOBAL_SETTINGS.update({
        "default_cli": settings.default_cli,
        "cli_settings": settings.cli_settings
    })
    
    return {"success": True, "settings": GLOBAL_SETTINGS}
