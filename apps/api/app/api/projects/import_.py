"""Project import endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.services.project_scanner import project_scanner

router = APIRouter()


class ImportableProject(BaseModel):
    path: str
    name: str
    type: str
    description: Optional[str]
    tech_stack: List[str]
    has_git: bool
    sessions_count: int
    created_at: str


class ProjectImportRequest(BaseModel):
    path: str
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/scan-claude-projects", response_model=List[ImportableProject])
async def scan_claude_projects():
    """Scan for existing Claude projects in ~/.claude/projects"""
    projects = project_scanner.scan_claude_projects()

    result = []
    for project in projects:
        metadata = project_scanner.get_project_metadata(project.path)

        result.append(ImportableProject(
            path=project.path,
            name=project.name,
            type=metadata.get("type", "unknown"),
            description=metadata.get("description", ""),
            tech_stack=metadata.get("tech_stack", []),
            has_git=metadata.get("has_git", False),
            sessions_count=len(project.sessions),
            created_at=project.created_at.isoformat()
        ))

    return result


@router.get("/scan-directory/{path:path}", response_model=List[ImportableProject])
async def scan_directory(path: str):
    """Scan a directory for potential projects"""
    projects = project_scanner.scan_directory_for_projects(path)

    result = []
    for project in projects:
        metadata = project_scanner.get_project_metadata(project.path)

        result.append(ImportableProject(
            path=project.path,
            name=project.name,
            type=metadata.get("type", "unknown"),
            description=metadata.get("description", ""),
            tech_stack=metadata.get("tech_stack", []),
            has_git=metadata.get("has_git", False),
            sessions_count=len(project.sessions),
            created_at=project.created_at.isoformat()
        ))

    return result


@router.post("/import")
async def import_project(
    import_request: ProjectImportRequest,
    db: Session = Depends(get_db)
):
    """Import an existing project"""
    # Check if project already exists
    existing = db.query(ProjectModel).filter(
        ProjectModel.repo_path == import_request.path
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Project already imported")

    # Get project metadata
    metadata = project_scanner.get_project_metadata(import_request.path)

    # Create project
    project_id = f"project-{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:8]}"

    project = ProjectModel(
        id=project_id,
        name=import_request.name or metadata["name"],
        description=import_request.description or metadata.get("description"),
        repo_path=import_request.path,
        status="active",
        preferred_cli="claude",  # Default to Claude
        settings={
            "imported": True,
            "original_type": metadata.get("type"),
            "tech_stack": metadata.get("tech_stack", []),
            "has_git": metadata.get("has_git", False)
        }
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    ui.success(f"Imported project: {project.name} from {import_request.path}", "Import")

    return {
        "project_id": project.id,
        "name": project.name,
        "path": project.repo_path,
        "message": "Project imported successfully"
    }