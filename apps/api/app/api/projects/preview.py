"""
Project Preview Management
Handles preview server operations for projects
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.services.local_runtime import (
    start_preview_process,
    stop_preview_process,
    preview_status,
    get_preview_logs,
    get_all_preview_logs
)


router = APIRouter()


class PreviewStartRequest(BaseModel):
    port: Optional[int] = None


class PreviewStatusResponse(BaseModel):
    running: bool
    port: Optional[int] = None
    url: Optional[str] = None
    process_id: Optional[int] = None
    error: Optional[str] = None


class PreviewLogsResponse(BaseModel):
    logs: str
    running: bool


@router.post("/{project_id}/preview/start", response_model=PreviewStatusResponse)
async def start_preview(
    project_id: str,
    body: PreviewStartRequest = PreviewStartRequest(),
    db: Session = Depends(get_db)
):
    """Start preview server for a project"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if preview is already running
    status = preview_status(project_id)
    if status == "running":
        # Get existing port from somewhere or use default
        return PreviewStatusResponse(
            running=True,
            port=None,  # TODO: Store port information
            url=None,
            process_id=None
        )
    
    # Validate repo_path before starting preview
    if not project.repo_path:
        raise HTTPException(
            status_code=400,
            detail=f"Project {project_id} is not fully initialized yet. repo_path is null. Please wait for initialization to complete."
        )

    # Start preview
    try:
        process_name, port = start_preview_process(project_id, project.repo_path, port=body.port)
    except RuntimeError as e:
        if "Invalid repo_path" in str(e) or "not fully initialized" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=f"Failed to start preview: {str(e)}")
    result = {
        "success": True,
        "port": port,
        "url": f"http://localhost:{port}",
        "process_name": process_name
    }
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to start preview"))
    
    # Update project status
    project.status = "preview_running"
    project.preview_url = result.get("url")
    db.commit()
    
    return PreviewStatusResponse(
        running=True,
        port=result.get("port"),
        url=result.get("url"),
        process_id=result.get("process_id")
    )


@router.get("/{project_id}/error-logs")
async def get_all_error_logs(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Get all error logs from the preview process"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all stored logs for this project
    all_logs = get_all_preview_logs(project_id)
    
    return {"logs": all_logs, "project_id": project_id}


@router.post("/{project_id}/preview/stop")
async def stop_preview(project_id: str, db: Session = Depends(get_db)):
    """Stop preview server for a project"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Stop preview
    stop_preview_process(project_id)
    
    # Update project status
    project.status = "idle"
    project.preview_url = None
    db.commit()
    
    return {"message": "Preview stopped successfully"}


@router.get("/{project_id}/preview/status", response_model=PreviewStatusResponse)
async def get_preview_status(project_id: str, db: Session = Depends(get_db)):
    """Get preview server status for a project"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    status = preview_status(project_id)
    
    return PreviewStatusResponse(
        running=(status == "running"),
        port=None,  # TODO: Store port information
        url=None,
        process_id=None,
        error=None
    )


@router.get("/{project_id}/preview/logs", response_model=PreviewLogsResponse)
async def get_preview_logs_endpoint(
    project_id: str,
    lines: int = 100,
    db: Session = Depends(get_db)
):
    """Get preview server logs for a project"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    logs = get_preview_logs(project_id, lines=lines)
    status = preview_status(project_id)
    
    return PreviewLogsResponse(
        logs=logs,
        running=status.get("running", False)
    )


@router.post("/{project_id}/preview/restart")
async def restart_preview(
    project_id: str,
    body: PreviewStartRequest = PreviewStartRequest(),
    db: Session = Depends(get_db)
):
    """Restart preview server for a project"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Stop if running
    status = preview_status(project_id)
    if status == "running":
        stop_preview_process(project_id)
        # No need to check result as stop_preview_process returns None
    
    # Validate repo_path before starting preview
    if not project.repo_path:
        raise HTTPException(
            status_code=400,
            detail=f"Project {project_id} is not fully initialized yet. repo_path is null. Please wait for initialization to complete."
        )

    # Start preview
    try:
        process_name, port = start_preview_process(project_id, project.repo_path, port=body.port)
    except RuntimeError as e:
        if "Invalid repo_path" in str(e) or "not fully initialized" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=f"Failed to start preview: {str(e)}")
    result = {
        "success": True,
        "port": port,
        "url": f"http://localhost:{port}",
        "process_name": process_name
    }
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to restart preview"))
    
    # Update project status
    project.status = "preview_running"
    project.preview_url = result.get("url")
    db.commit()
    
    return PreviewStatusResponse(
        running=True,
        port=result.get("port"),
        url=result.get("url"),
        process_id=result.get("process_id")
    )


@router.get("/{project_id}/error-logs")
async def get_all_error_logs(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Get all error logs from the preview process"""
    
    project = db.get(ProjectModel, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all stored logs for this project
    all_logs = get_all_preview_logs(project_id)
    
    return {"logs": all_logs, "project_id": project_id}