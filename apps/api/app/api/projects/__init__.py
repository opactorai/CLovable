"""
Projects API Router
Combines all project-related endpoints
"""
from fastapi import APIRouter

from .crud import router as crud_router
from .preview import router as preview_router
from .system_prompt import router as system_prompt_router
from .mcp import router as mcp_router
from .import_ import router as import_router
from .git import router as git_router


# Create main projects router (prefix will be added in main.py)
router = APIRouter()

# Include sub-routers without additional prefix
router.include_router(crud_router, tags=["projects"])
router.include_router(preview_router, tags=["projects"])
router.include_router(system_prompt_router, tags=["projects"])
router.include_router(mcp_router, tags=["projects", "mcp"])
router.include_router(import_router, tags=["projects", "import"])
router.include_router(git_router, tags=["projects", "git"])