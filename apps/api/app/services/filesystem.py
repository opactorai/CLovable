import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional


def ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def init_git_repo(repo_path: str) -> None:
    from app.core.terminal_ui import ui

    git_cmd = shutil.which("git.exe" if os.name == "nt" else "git") or shutil.which("git")
    if not git_cmd:
        raise Exception(
            "Git is not available on the PATH. Please install Git and ensure the 'git' command is accessible."
        )

    try:
        subprocess.run([git_cmd, "init"], cwd=repo_path, check=True)
        subprocess.run([git_cmd, "add", "-A"], cwd=repo_path, check=True)
        subprocess.run([git_cmd, "commit", "-m", "Initial commit"], cwd=repo_path, check=True)
    except FileNotFoundError as e:
        ui.error(f"Git command not found: {e}", "Filesystem")
        raise Exception(
            "Git command could not be executed. Verify that Git is installed and available in your PATH."
        )
    except subprocess.CalledProcessError as e:
        ui.error(f"Failed to initialize git repository: {e}", "Filesystem")
        raise Exception("Failed to initialize git repository. See logs for details.")


def scaffold_nextjs_minimal(repo_path: str) -> None:
    """Create Next.js project using official create-next-app"""
    import subprocess
    import tempfile
    import shutil
    
    # Get parent directory to create project in
    parent_dir = Path(repo_path).parent
    project_name = Path(repo_path).name
    
    try:
        npx_available = any(
            shutil.which(candidate)
            for candidate in (["npx", "npx.cmd"] if os.name == "nt" else ["npx"])
        )

        if not npx_available:
            raise Exception(
                "Cannot find 'npx'. Install Node.js 18+ and ensure the 'npx' command is available on your PATH."
            )
        # Create Next.js app with TypeScript and Tailwind CSS
        base_cmd = [
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
        if os.name == "nt":
            cmd = ["cmd.exe", "/c"] + base_cmd
        else:
            cmd = base_cmd
        
        # Set environment for non-interactive mode
        env = os.environ.copy()
        env["CI"] = "true"  # Force non-interactive mode
        
        from app.core.terminal_ui import ui
        ui.info(f"Running create-next-app with command: {' '.join(cmd)}", "Filesystem")
        
        # Run create-next-app in the parent directory with timeout
        result = subprocess.run(
            cmd, 
            cwd=parent_dir, 
            check=True, 
            capture_output=True, 
            text=True,
            env=env,
            timeout=300  # 5 minute timeout
        )
        
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
        stderr_lower = (e.stderr or "").lower()
        if "is not recognized" in stderr_lower or "command not found" in stderr_lower:
            error_msg = "Cannot execute 'npx'. Install Node.js 18+ and ensure npx is on PATH."
        elif "eacces" in stderr_lower:
            error_msg = "Permission denied. Please check directory permissions."
        elif "enoent" in stderr_lower:
            error_msg = "Command not found. Please ensure Node.js and npm are installed."
        elif "network" in stderr_lower:
            error_msg = "Network error. Please check your internet connection."
        else:
            error_msg = f"Failed to create Next.js project: {e.stderr or e.stdout or str(e)}"

        raise Exception(error_msg)
    except FileNotFoundError as e:
        ui.error(f"create-next-app command not found: {e}", "Filesystem")
        raise Exception(
            "Unable to execute create-next-app. Ensure Node.js and npm are installed and 'npx' is available on PATH."
        )


def write_env_file(project_dir: str, content: str) -> None:
    (Path(project_dir) / ".env").write_text(content)
