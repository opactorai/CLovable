import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional


def ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def init_git_repo(repo_path: str) -> None:
    subprocess.run(["git", "init"], cwd=repo_path, check=True)
    subprocess.run(["git", "add", "-A"], cwd=repo_path, check=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=repo_path, check=True)


def scaffold_nextjs_minimal(repo_path: str) -> None:
    """Create Next.js project using official create-next-app"""
    import subprocess
    import tempfile
    import shutil
    import platform

    # Get parent directory to create project in
    parent_dir = Path(repo_path).parent
    project_name = Path(repo_path).name

    try:
        # Create Next.js app with TypeScript and Tailwind CSS
        cmd = [
            "npx",
            "create-next-app@latest",
            project_name,
            "--typescript",
            "--tailwind",
            "--eslint",
            "--app",
            "--import-alias", "@/*",
            "--use-npm",
            "--skip-install",  # We'll install dependencies later (handled by backend)
            "--yes"            # Auto-accept all prompts
        ]

        # Set environment for non-interactive mode
        env = os.environ.copy()
        env["CI"] = "true"  # Force non-interactive mode

        # Windows-specific environment setup
        is_windows = platform.system().lower() == "windows"
        if is_windows:
            env["FORCE_COLOR"] = "0"  # Disable colors that can cause issues
            env["NPM_CONFIG_COLOR"] = "false"
            env["NO_UPDATE_NOTIFIER"] = "true"
        
        from app.core.terminal_ui import ui
        ui.info(f"Running create-next-app with command: {' '.join(cmd)}", "Filesystem")

        # Windows-specific subprocess configuration
        subprocess_kwargs = {
            "cwd": parent_dir,
            "check": True,
            "capture_output": True,
            "text": True,
            "env": env,
            "timeout": 300  # 5 minute timeout
        }

        if is_windows:
            # On Windows, use shell=True for better npm/npx compatibility
            subprocess_kwargs["shell"] = True
            # Convert command list to string for shell=True
            cmd_str = " ".join(f'"{arg}"' if " " in arg else arg for arg in cmd)
            ui.info(f"Windows detected - using shell mode: {cmd_str}", "Filesystem")
            result = subprocess.run(cmd_str, **subprocess_kwargs)
        else:
            # Unix systems use the command list directly
            result = subprocess.run(cmd, **subprocess_kwargs)
        
        ui.success(f"Created Next.js app: {result.stdout}", "Filesystem")
        
        # Skip npm install for faster project creation
        # Users can run 'npm install' manually when needed
        ui.info("Skipped dependency installation for faster setup", "Filesystem")
        
    except subprocess.TimeoutExpired as e:
        ui.error("create-next-app timed out after 5 minutes", "Filesystem")
        raise Exception(f"Project creation timed out. This might be due to slow network or hung process.")
    except subprocess.CalledProcessError as e:
        ui.error(f"Error creating Next.js app: {e}", "Filesystem")
        ui.debug(f"Command: {' '.join(cmd)}", "Filesystem")
        ui.debug(f"stdout: {e.stdout}", "Filesystem")
        ui.debug(f"stderr: {e.stderr}", "Filesystem")
        
        # Provide more specific error messages
        if "EACCES" in str(e.stderr):
            error_msg = "Permission denied. Please check directory permissions."
        elif "ENOENT" in str(e.stderr):
            error_msg = "Command not found. Please ensure Node.js and npm are installed."
        elif "network" in str(e.stderr).lower():
            error_msg = "Network error. Please check your internet connection."
        else:
            error_msg = f"Failed to create Next.js project: {e.stderr or e.stdout or str(e)}"
        
        raise Exception(error_msg)


def write_env_file(project_dir: str, content: str) -> None:
    (Path(project_dir) / ".env").write_text(content)
