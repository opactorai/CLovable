"""
CLI Preferences API Endpoints
Handles CLI selection and configuration
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.api.deps import get_db
from app.models.projects import Project
from app.services.cli import UnifiedCLIManager
from app.services.cli.base import CLIType


router = APIRouter()


class CLIPreferenceRequest(BaseModel):
    preferred_cli: str


class ModelPreferenceRequest(BaseModel):
    model_id: str




class CLIStatusResponse(BaseModel):
    cli_type: str
    available: bool
    configured: bool
    error: Optional[str] = None
    models: Optional[list] = None


class AllCLIStatusResponse(BaseModel):
    claude: CLIStatusResponse
    cursor: CLIStatusResponse
    codex: CLIStatusResponse
    qwen: CLIStatusResponse
    gemini: CLIStatusResponse
    preferred_cli: str


@router.get("/{project_id}/cli/available")
async def get_cli_available(project_id: str, db: Session = Depends(get_db)):
    """Get CLI information for project (used by frontend ProjectSettings)"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "current_preference": project.preferred_cli,
        "current_model": project.selected_model,
        "fallback_enabled": project.fallback_enabled
    }


@router.get("/{project_id}/cli-preference")
async def get_cli_preference(project_id: str, db: Session = Depends(get_db)):
    """Get current CLI preference for a project"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Handle projects that might not have these fields set
    preferred_cli = getattr(project, 'preferred_cli', 'claude')
    selected_model = getattr(project, 'selected_model', None)
    
    return {
        "preferred_cli": preferred_cli,
        "selected_model": selected_model
    }


@router.post("/{project_id}/cli-preference")
async def set_cli_preference(
    project_id: str,
    body: CLIPreferenceRequest,
    db: Session = Depends(get_db)
):
    """Set CLI preference for a project"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate CLI type
    try:
        cli_type = CLIType(body.preferred_cli)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid CLI type: {body.preferred_cli}"
        )
    
    # Update project preferences
    project.preferred_cli = cli_type.value
    db.commit()
    
    return {
        "preferred_cli": project.preferred_cli,
        "message": f"CLI preference updated to {cli_type.value}"
    }


@router.post("/{project_id}/model-preference")
async def set_model_preference(
    project_id: str,
    body: ModelPreferenceRequest,
    db: Session = Depends(get_db)
):
    """Set model preference for a project"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.selected_model = body.model_id
    db.commit()
    
    return {
        "selected_model": project.selected_model,
        "message": f"Model preference updated to {body.model_id}"
    }




@router.get("/{project_id}/cli-status/{cli_type}", response_model=CLIStatusResponse)
async def get_cli_status(
    project_id: str,
    cli_type: str,
    db: Session = Depends(get_db)
):
    """Check status of a specific CLI"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        cli_enum = CLIType(cli_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid CLI type: {cli_type}")
    
    cli_manager = UnifiedCLIManager(
        project_id=project.id,
        project_path=project.repo_path,
        session_id="status_check",
        conversation_id="status_check",
        db=db
    )
    
    status = await cli_manager.check_cli_status(cli_enum)
    
    return CLIStatusResponse(
        cli_type=cli_type,
        available=status.get("available", False),
        configured=status.get("configured", False),
        error=status.get("error"),
        models=status.get("models")
    )


@router.get("/{project_id}/cli-status", response_model=AllCLIStatusResponse)
async def get_all_cli_status(project_id: str, db: Session = Depends(get_db)):
    """Check status of all CLIs"""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    preferred_cli = getattr(project, 'preferred_cli', 'claude')

    # Build real status for each CLI using UnifiedCLIManager
    manager = UnifiedCLIManager(
        project_id=project.id,
        project_path=project.repo_path,
        session_id="status_check",
        conversation_id="status_check",
        db=db,
    )

    def to_resp(cli_key: str, status: Dict[str, Any]) -> CLIStatusResponse:
        return CLIStatusResponse(
            cli_type=cli_key,
            available=status.get("available", False),
            configured=status.get("configured", False),
            error=status.get("error"),
            models=status.get("models"),
        )

    claude_status = await manager.check_cli_status(CLIType.CLAUDE)
    cursor_status = await manager.check_cli_status(CLIType.CURSOR)
    codex_status = await manager.check_cli_status(CLIType.CODEX)
    qwen_status = await manager.check_cli_status(CLIType.QWEN)
    gemini_status = await manager.check_cli_status(CLIType.GEMINI)

    return AllCLIStatusResponse(
        claude=to_resp("claude", claude_status),
        cursor=to_resp("cursor", cursor_status),
        codex=to_resp("codex", codex_status),
        qwen=to_resp("qwen", qwen_status),
        gemini=to_resp("gemini", gemini_status),
        preferred_cli=preferred_cli,
    )
