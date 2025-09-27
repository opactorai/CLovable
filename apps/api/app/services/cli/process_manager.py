"""
Global CLI process management for tracking and terminating running CLI processes.
"""
import asyncio
import os
import signal
from typing import Dict, Optional
from app.core.terminal_ui import ui

# Global registry of running CLI processes
# Key: session_id, Value: asyncio.subprocess.Process
_cli_processes: Dict[str, asyncio.subprocess.Process] = {}


def register_process(session_id: str, process: asyncio.subprocess.Process) -> None:
    """Register a CLI process for tracking."""
    _cli_processes[session_id] = process
    ui.info(f"Registered CLI process for session {session_id} (PID: {process.pid})", "ProcessManager")


def unregister_process(session_id: str) -> None:
    """Remove a CLI process from tracking."""
    if session_id in _cli_processes:
        del _cli_processes[session_id]
        ui.info(f"Unregistered CLI process for session {session_id}", "ProcessManager")


async def terminate_process(session_id: str) -> bool:
    """Terminate a specific CLI process by session ID."""
    process = _cli_processes.get(session_id)
    if not process:
        ui.warning(f"No process found for session {session_id}", "ProcessManager")
        return False

    try:
        # First try graceful termination
        ui.info(f"Terminating process for session {session_id} (PID: {process.pid})", "ProcessManager")
        process.terminate()

        # Wait up to 5 seconds for graceful termination
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
            ui.info(f"Process terminated gracefully for session {session_id}", "ProcessManager")
        except asyncio.TimeoutError:
            # Force kill if graceful termination fails
            ui.warning(f"Graceful termination failed, force killing process {process.pid}", "ProcessManager")
            process.kill()
            await process.wait()
            ui.info(f"Process force killed for session {session_id}", "ProcessManager")

        # Unregister the process
        unregister_process(session_id)
        return True

    except Exception as e:
        ui.error(f"Failed to terminate process for session {session_id}: {e}", "ProcessManager")
        return False


async def terminate_project_processes(project_id: str) -> int:
    """Terminate all CLI processes for a specific project."""
    terminated_count = 0
    sessions_to_terminate = []

    # Find all sessions for this project (session IDs typically contain project ID)
    for session_id in _cli_processes.keys():
        if project_id in session_id:
            sessions_to_terminate.append(session_id)

    # Terminate each process
    for session_id in sessions_to_terminate:
        if await terminate_process(session_id):
            terminated_count += 1

    ui.info(f"Terminated {terminated_count} processes for project {project_id}", "ProcessManager")
    return terminated_count


def get_running_processes() -> Dict[str, int]:
    """Get all currently running CLI processes with their PIDs."""
    active_processes = {}
    for session_id, process in list(_cli_processes.items()):
        if process.returncode is None:
            active_processes[session_id] = process.pid
        else:
            # Process has ended, clean up
            unregister_process(session_id)

    return active_processes


def cleanup_ended_processes() -> None:
    """Clean up references to processes that have already ended."""
    ended_sessions = []
    for session_id, process in _cli_processes.items():
        if process.returncode is not None:
            ended_sessions.append(session_id)

    for session_id in ended_sessions:
        unregister_process(session_id)

    if ended_sessions:
        ui.info(f"Cleaned up {len(ended_sessions)} ended processes", "ProcessManager")