"""
Project Scanner Service
Scans filesystem for existing Claude projects and imports them
"""
import os
import json
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.terminal_ui import ui


class ProjectInfo:
    def __init__(self, path: str, name: str, sessions: List[str], created_at: datetime):
        self.path = path
        self.name = name
        self.sessions = sessions
        self.created_at = created_at


class ProjectScanner:
    """Scans for existing Claude projects"""

    @staticmethod
    def scan_claude_projects() -> List[ProjectInfo]:
        """Scan ~/.claude/projects for existing projects"""
        projects = []
        claude_dir = Path.home() / ".claude" / "projects"

        if not claude_dir.exists():
            ui.info("No ~/.claude/projects directory found", "Scanner")
            return projects

        try:
            for project_dir in claude_dir.iterdir():
                if not project_dir.is_dir():
                    continue

                # Decode project path from directory name
                try:
                    decoded_path = base64.b64decode(project_dir.name + "==").decode('utf-8')
                except:
                    # If decoding fails, use directory name as path
                    decoded_path = project_dir.name

                # Get project name from path
                project_name = os.path.basename(decoded_path) or decoded_path

                # Find session files
                sessions_dir = project_dir / "sessions"
                sessions = []
                if sessions_dir.exists():
                    for session_file in sessions_dir.glob("*.jsonl"):
                        sessions.append(session_file.stem)

                # Get creation time
                created_at = datetime.fromtimestamp(project_dir.stat().st_ctime)

                projects.append(ProjectInfo(
                    path=decoded_path,
                    name=project_name,
                    sessions=sessions,
                    created_at=created_at
                ))

        except Exception as e:
            ui.error(f"Error scanning Claude projects: {str(e)}", "Scanner")

        ui.info(f"Found {len(projects)} existing Claude projects", "Scanner")
        return projects

    @staticmethod
    def scan_directory_for_projects(directory: str) -> List[ProjectInfo]:
        """Scan a specific directory for potential projects"""
        projects = []
        scan_path = Path(directory)

        if not scan_path.exists() or not scan_path.is_dir():
            return projects

        try:
            # Look for common project indicators
            project_indicators = [
                "package.json",
                "pom.xml",
                "Cargo.toml",
                "requirements.txt",
                "go.mod",
                ".git",
                "README.md"
            ]

            for item in scan_path.iterdir():
                if not item.is_dir():
                    continue

                # Check if directory contains project indicators
                has_indicators = any(
                    (item / indicator).exists()
                    for indicator in project_indicators
                )

                if has_indicators:
                    project_name = item.name
                    created_at = datetime.fromtimestamp(item.stat().st_ctime)

                    projects.append(ProjectInfo(
                        path=str(item),
                        name=project_name,
                        sessions=[],  # No existing sessions for new projects
                        created_at=created_at
                    ))

        except Exception as e:
            ui.error(f"Error scanning directory {directory}: {str(e)}", "Scanner")

        return projects

    @staticmethod
    def get_project_metadata(project_path: str) -> Dict[str, Any]:
        """Extract metadata from a project directory"""
        metadata = {
            "name": os.path.basename(project_path),
            "path": project_path,
            "type": "unknown",
            "description": "",
            "tech_stack": [],
            "has_git": False
        }

        project_dir = Path(project_path)

        try:
            # Check for Git
            if (project_dir / ".git").exists():
                metadata["has_git"] = True

            # Check project type
            if (project_dir / "package.json").exists():
                metadata["type"] = "nodejs"
                metadata["tech_stack"].append("Node.js")

                # Read package.json for more info
                try:
                    with open(project_dir / "package.json", 'r') as f:
                        package_data = json.load(f)
                        if package_data.get("description"):
                            metadata["description"] = package_data["description"]

                        # Detect frameworks
                        deps = {**package_data.get("dependencies", {}), **package_data.get("devDependencies", {})}
                        if "next" in deps:
                            metadata["tech_stack"].append("Next.js")
                        if "react" in deps:
                            metadata["tech_stack"].append("React")
                        if "vue" in deps:
                            metadata["tech_stack"].append("Vue.js")
                        if "typescript" in deps:
                            metadata["tech_stack"].append("TypeScript")

                except Exception:
                    pass

            elif (project_dir / "requirements.txt").exists():
                metadata["type"] = "python"
                metadata["tech_stack"].append("Python")

            elif (project_dir / "Cargo.toml").exists():
                metadata["type"] = "rust"
                metadata["tech_stack"].append("Rust")

            elif (project_dir / "go.mod").exists():
                metadata["type"] = "go"
                metadata["tech_stack"].append("Go")

            # Check for README
            for readme_name in ["README.md", "readme.md", "README.txt", "readme.txt"]:
                readme_path = project_dir / readme_name
                if readme_path.exists():
                    try:
                        with open(readme_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Extract first non-empty line as description if we don't have one
                            if not metadata["description"]:
                                for line in content.split('\n'):
                                    line = line.strip().lstrip('#').strip()
                                    if line and len(line) > 10:
                                        metadata["description"] = line[:200] + ("..." if len(line) > 200 else "")
                                        break
                    except Exception:
                        pass

        except Exception as e:
            ui.warning(f"Error extracting metadata from {project_path}: {str(e)}", "Scanner")

        return metadata


# Global scanner instance
project_scanner = ProjectScanner()