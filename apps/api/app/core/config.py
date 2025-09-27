from pydantic import BaseModel
import os
from pathlib import Path


def find_project_root() -> Path:
    """
    Find the project root directory by looking for specific marker files.
    This ensures consistent behavior regardless of where the API is executed from.
    """
    current_path = Path(__file__).resolve()
    
    # Start from current file and go up
    for parent in [current_path] + list(current_path.parents):
        # Check if this directory has both apps/ and Makefile (project root indicators)
        if (parent / 'apps').is_dir() and (parent / 'Makefile').exists():
            return parent
    
    # Fallback: navigate up from apps/api to project root
    # Current path is likely: /project-root/apps/api/app/core/config.py
    # So we need to go up 4 levels: config.py -> core -> app -> api -> apps -> project-root
    api_dir = current_path.parent.parent.parent  # /project-root/apps/api
    if api_dir.name == 'api' and api_dir.parent.name == 'apps':
        return api_dir.parent.parent  # /project-root
    
    # Last resort: current working directory
    return Path.cwd()


# Get project root once at module load
PROJECT_ROOT = find_project_root()


class Settings(BaseModel):
    api_port: int = int(os.getenv("API_PORT", "8080"))
    
    # SQLite database URL
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{PROJECT_ROOT / 'data' / 'cc.db'}",
    )
    
    # Use project root relative paths
    projects_root: str = os.getenv("PROJECTS_ROOT", str(PROJECT_ROOT / "data" / "projects"))
    projects_root_host: str = os.getenv("PROJECTS_ROOT_HOST", os.getenv("PROJECTS_ROOT", str(PROJECT_ROOT / "data" / "projects")))
    
    preview_port_start: int = int(os.getenv("PREVIEW_PORT_START", "3100"))
    preview_port_end: int = int(os.getenv("PREVIEW_PORT_END", "3999"))
    @property
    def preview_port_fixed(self) -> int | None:
        val = os.getenv("PREVIEW_PORT_FIXED")
        if val and val.strip().lower() in {"", "auto", "none"}:
            return None
        elif val:
            return int(val)
        else:
            return 3100


settings = Settings()
