import os
import shutil
import subprocess
import platform
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
    
    # Get parent directory to create project in
    parent_dir = Path(repo_path).parent
    project_name = Path(repo_path).name
    
    # Import ui at the beginning to avoid import issues
    try:
        from app.core.terminal_ui import ui
    except ImportError:
        # Fallback if ui module is not available
        class MockUI:
            def info(self, msg, context=""): print(f"[{context}] INFO: {msg}")
            def success(self, msg, context=""): print(f"[{context}] SUCCESS: {msg}")
            def error(self, msg, context=""): print(f"[{context}] ERROR: {msg}")
            def debug(self, msg, context=""): print(f"[{context}] DEBUG: {msg}")
            def warning(self, msg, context=""): print(f"[{context}] WARNING: {msg}")
        
        ui = MockUI()
    
    def find_node_command(command: str) -> str:
        """Find Node.js command in common Windows locations"""
        
        if platform.system() != "Windows":
            return command
        
        # Common Windows Node.js installation paths
        possible_paths = [
            r"C:\Program Files\nodejs",
            r"C:\Program Files (x86)\nodejs",
            os.path.expanduser(r"~\AppData\Roaming\npm"),
            os.path.expanduser(r"~\AppData\Local\Programs\nodejs"),
        ]
        
        # Add current PATH
        path_dirs = os.environ.get("PATH", "").split(os.pathsep)
        possible_paths.extend(path_dirs)
        
        # Look for the command
        for path_dir in possible_paths:
            if not path_dir:
                continue
            
            # Try different file extensions for Windows
            extensions = [".exe", ".cmd", ".bat", ""]
            for ext in extensions:
                cmd_path = os.path.join(path_dir, f"{command}{ext}")
                if os.path.exists(cmd_path):
                    ui.debug(f"Found {command} at: {cmd_path}", "Filesystem")
                    return cmd_path
        
        # If not found, return original command (will fail with clear error)
        return command
    
    try:
        # Find Node.js commands
        node_cmd = find_node_command("node")
        npm_cmd = find_node_command("npm")
        npx_cmd = find_node_command("npx")
        
        # First check if Node.js is available
        try:
            subprocess.run([node_cmd, "--version"], check=True, capture_output=True, timeout=10)
            ui.info(f"Node.js found at: {node_cmd}", "Filesystem")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            raise Exception("Node.js non è installato. Installa Node.js da https://nodejs.org/")
        
        # Then check if npm is available
        try:
            # Use shell=True for npm on Windows to avoid execution issues
            if platform.system() == "Windows":
                subprocess.run(f'"{npm_cmd}" --version', shell=True, check=True, capture_output=True, timeout=10)
            else:
                subprocess.run([npm_cmd, "--version"], check=True, capture_output=True, timeout=10)
            ui.info(f"npm found at: {npm_cmd}", "Filesystem")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            raise Exception("npm non è disponibile. Assicurati che Node.js sia installato correttamente.")
        
        # Finally check if npx is available
        try:
            # Use shell=True for npx on Windows to avoid execution issues
            if platform.system() == "Windows":
                subprocess.run(f'"{npx_cmd}" --version', shell=True, check=True, capture_output=True, timeout=10)
            else:
                subprocess.run([npx_cmd, "--version"], check=True, capture_output=True, timeout=10)
            ui.info(f"npx found at: {npx_cmd}", "Filesystem")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            raise Exception("npx non è disponibile. Assicurati che Node.js e npm siano installati correttamente.")
        
        # Create Next.js app with TypeScript and Tailwind CSS
        # Set environment for non-interactive mode
        env = os.environ.copy()
        env["CI"] = "true"  # Force non-interactive mode
        
        # Add Node.js paths to environment
        if platform.system() == "Windows":
            node_dir = os.path.dirname(node_cmd)
            if node_dir not in env.get("PATH", ""):
                env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
        
        if platform.system() == "Windows":
            # Use shell=True on Windows to avoid execution issues
            cmd_str = f'"{npx_cmd}" create-next-app@latest {project_name} --typescript --tailwind --eslint --app --import-alias @/* --use-npm --skip-install --yes'
            ui.info(f"Running create-next-app with command: {cmd_str}", "Filesystem")
            ui.debug(f"Working directory: {parent_dir}", "Filesystem")
            ui.debug(f"Environment PATH: {env.get('PATH', '')[:200]}...", "Filesystem")
            
            # Run create-next-app in the parent directory with timeout
            result = subprocess.run(
                cmd_str, 
                cwd=parent_dir, 
                check=True, 
                capture_output=True, 
                text=True,
                env=env,
                shell=True,
                timeout=300  # 5 minute timeout
            )
        else:
            # Use array format for Unix-like systems
            cmd = [
                npx_cmd, 
                "create-next-app@latest", 
                project_name,
                "--typescript",
                "--tailwind", 
                "--eslint",
                "--app",
                "--import-alias", "@/*",
                "--use-npm",
                "--skip-install",  # We'll install dependencies later
                "--yes"            # Auto-accept all prompts
            ]
            
            ui.info(f"Running create-next-app with command: {' '.join(cmd)}", "Filesystem")
            ui.debug(f"Working directory: {parent_dir}", "Filesystem")
            ui.debug(f"Environment PATH: {env.get('PATH', '')[:200]}...", "Filesystem")
            
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
        
        # Show command that was executed
        if platform.system() == "Windows":
            ui.debug(f"Command executed: {cmd_str}", "Filesystem")
        else:
            ui.debug(f"Command executed: {' '.join(cmd)}", "Filesystem")
        
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
    except FileNotFoundError as e:
        ui.error(f"File not found error: {e}", "Filesystem")
        raise Exception("npx o create-next-app non trovato. Verifica che Node.js sia installato correttamente.")
    except Exception as e:
        ui.error(f"Unexpected error: {e}", "Filesystem")
        raise Exception(f"Errore imprevisto durante la creazione del progetto: {str(e)}")


def write_env_file(project_dir: str, content: str) -> None:
    (Path(project_dir) / ".env").write_text(content)
