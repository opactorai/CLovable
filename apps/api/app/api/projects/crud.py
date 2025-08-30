"""
Project CRUD Operations
Handles create, read, update, delete operations for projects
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
import re
import uuid
import asyncio
import os

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.models.messages import Message
from app.models.project_services import ProjectServiceConnection
from app.models.sessions import Session as SessionModel
from app.services.project.initializer import initialize_project
from app.core.websocket.manager import manager as websocket_manager

# Project ID validation regex
PROJECT_ID_REGEX = re.compile(r"^[a-z0-9-]{3,}$")

# Pydantic models
class ProjectCreate(BaseModel):
    project_id: str = Field(..., pattern=PROJECT_ID_REGEX.pattern)
    name: str
    initial_prompt: Optional[str] = None
    preferred_cli: Optional[str] = "claude"
    selected_model: Optional[str] = None
    fallback_enabled: Optional[bool] = True
    cli_settings: Optional[dict] = None

class ProjectUpdate(BaseModel):
    name: str

class ServiceConnection(BaseModel):
    provider: str
    status: str
    connected: bool

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str = "idle"
    preview_url: Optional[str] = None
    created_at: datetime
    last_active_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    services: Optional[dict] = None
    features: Optional[List[str]] = None
    tech_stack: Optional[List[str]] = None
    ai_generated: Optional[bool] = None
    initial_prompt: Optional[str] = None
    preferred_cli: Optional[str] = None
    selected_model: Optional[str] = None

router = APIRouter()

# Use the global WebSocket manager instance shared across the app

# Metadata generation removed - using initial prompt directly in chat

async def initialize_project_background(project_id: str, project_name: str, body: ProjectCreate):
    """Initialize project in background with WebSocket progress updates"""
    try:
        # Send initial status update
        await websocket_manager.broadcast_to_project(project_id, {
            "type": "project_status",
            "data": {
                "status": "initializing",
                "message": "Initializing project files..."
            }
        })
        
        # Initialize the project using the existing initializer
        from app.services.project.initializer import initialize_project
        from app.api.deps import get_db
        
        # Create new database session for background task
        db_session = next(get_db())
        
        try:
            # Start both tasks concurrently for faster initialization
            tasks = []
            
            # Task 1: Initialize project files
            async def init_project_task():
                project_path = await initialize_project(project_id, project_name)
                
                # Update project with repo path using fresh session
                project = db_session.query(ProjectModel).filter(ProjectModel.id == project_id).first()
                if project:
                    project.repo_path = project_path
                    db_session.commit()
                
                return project_path
            
            tasks.append(init_project_task())
            
            # Skip metadata generation - will use initial prompt directly
            
            # Wait for both tasks to complete concurrently
            await asyncio.gather(*tasks)
            
            # Now set status to active and send final completion message
            project = db_session.query(ProjectModel).filter(ProjectModel.id == project_id).first()
            if project:
                project.status = "active"
                db_session.commit()
            
            # Send final completion status
            await websocket_manager.broadcast_to_project(project_id, {
                "type": "project_status",
                "data": {
                    "status": "active",
                    "message": "Project ready!"
                }
            })
            
            print(f"✅ Project {project_id} initialized successfully")
            
        finally:
            db_session.close()
        
    except Exception as e:
        # Create separate session for error handling
        error_db = next(get_db())
        try:
            # Update project status to failed
            project = error_db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
            if project:
                project.status = "failed"
                error_db.commit()
        finally:
            error_db.close()
        
        # Send error status
        await websocket_manager.broadcast_to_project(project_id, {
            "type": "project_status",
            "data": {
                "status": "failed",
                "message": f"Failed to initialize project: {str(e)}"
            }
        })
        
        print(f"❌ Failed to initialize project {project_id}: {e}")


async def install_dependencies_background(project_id: str, project_path: str):
    """Install dependencies in background (npm)"""
    try:
        import subprocess
        import os

        package_json_path = os.path.join(project_path, "package.json")
        if os.path.exists(package_json_path):
            print(f"Installing dependencies for project {project_id}...")

            process = await asyncio.create_subprocess_exec(
                "npm", "install",
                cwd=project_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                print(f"Dependencies installed successfully for project {project_id}")
            else:
                print(
                    f"Failed to install dependencies for project {project_id}: {stderr.decode()}"
                )
    except Exception as e:
        print(f"Error installing dependencies: {e}")

@router.post("/{project_id}/install-dependencies")
async def install_project_dependencies(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Install project dependencies in background"""
    
    # Check if project exists
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project repository path not found")
    
    # Add background task for dependency installation
    background_tasks.add_task(install_dependencies_background, project_id, project.repo_path)
    
    return {"message": "Dependency installation started in background", "project_id": project_id}


@router.get("/health")
async def projects_health():
    """Simple health check for projects router"""
    return {"status": "ok", "router": "projects"}



@router.get("/", response_model=List[Project])
async def list_projects(db: Session = Depends(get_db)) -> List[Project]:
    """List all projects with their status and last activity"""
    
    # Get projects with their last message time using subquery
    last_message_subquery = (
        db.query(
            Message.project_id,
            func.max(Message.created_at).label('last_message_at')
        )
        .group_by(Message.project_id)
        .subquery()
    )
    
    # Query projects with last message time
    projects_with_last_message = (
        db.query(ProjectModel, last_message_subquery.c.last_message_at)
        .outerjoin(
            last_message_subquery,
            ProjectModel.id == last_message_subquery.c.project_id
        )
        .order_by(desc(ProjectModel.created_at))
        .all()
    )
    
    result: List[Project] = []
    for project, last_message_at in projects_with_last_message:
        # Get service connections for this project
        services = {}
        service_connections = db.query(ProjectServiceConnection).filter(
            ProjectServiceConnection.project_id == project.id
        ).all()
        
        for conn in service_connections:
            services[conn.provider] = {
                "connected": True,
                "status": conn.status
            }
        
        # Ensure all service types are represented
        for provider in ["github", "supabase", "vercel"]:
            if provider not in services:
                services[provider] = {
                    "connected": False,
                    "status": "disconnected"
                }
        
        # Extract AI-generated info from settings
        ai_info = project.settings or {}
        
        result.append(Project(
            id=project.id,
            name=project.name,
            description=ai_info.get('description'),
            status=project.status or "idle",
            preview_url=project.preview_url,
            created_at=project.created_at,
            last_active_at=project.last_active_at,
            last_message_at=last_message_at,
            services=services,
            features=ai_info.get('features'),
            tech_stack=ai_info.get('tech_stack'),
            ai_generated=ai_info.get('ai_generated', False),
            initial_prompt=project.initial_prompt,
            preferred_cli=project.preferred_cli,
            selected_model=project.selected_model
        ))
    
    return result


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    """Get a specific project by ID"""
    
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Extract AI-generated info from settings
        ai_info = project.settings or {}
        
        return Project(
            id=project.id,
            name=project.name,
            description=ai_info.get('description'),
            status=project.status or "idle",
            preview_url=project.preview_url,
            created_at=project.created_at,
            last_active_at=project.last_active_at,
            last_message_at=None,  # Simplified for debugging
            services={},  # Simplified for debugging
            features=ai_info.get('features'),
            tech_stack=ai_info.get('tech_stack'),
            ai_generated=ai_info.get('ai_generated', False),
            initial_prompt=project.initial_prompt,
            preferred_cli=project.preferred_cli,
            selected_model=project.selected_model
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/", response_model=Project)
async def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db)
) -> Project:
    """Create a new project"""
    
    print(f"🔧 [CreateProject] Received request: {body}")
    print(f"🔧 [CreateProject] CLI: {body.preferred_cli}, Model: {body.selected_model}")
    
    # Check if project already exists
    existing = db.query(ProjectModel).filter(ProjectModel.id == body.project_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Project {body.project_id} already exists")
    
    # Create database record with initializing status
    preferred_cli = body.preferred_cli or "claude"
    # Set default model based on CLI
    selected_model = body.selected_model
    if not selected_model:
        if preferred_cli == "claude":
            selected_model = "sonnet-4"  # Use unified model name
        elif preferred_cli == "cursor":
            selected_model = "sonnet-4"  # Use unified model name
    fallback_enabled = body.fallback_enabled if body.fallback_enabled is not None else True
    
    print(f"🔧 [CreateProject] Creating project {body.project_id} with CLI: {preferred_cli}, Model: {selected_model}, Fallback: {fallback_enabled}")
    
    project = ProjectModel(
        id=body.project_id,
        name=body.name,
        repo_path=None,  # Will be set after initialization
        initial_prompt=body.initial_prompt,
        status="initializing",  # Set to initializing
        created_at=datetime.utcnow(),
        preferred_cli=preferred_cli,
        selected_model=selected_model,
        fallback_enabled=fallback_enabled
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Send immediate status update
    await websocket_manager.broadcast_to_project(project.id, {
        "type": "project_status",
        "data": {
            "status": "initializing",
            "message": "Setting up workspace..."
        }
    })
    
    # Start project initialization in background
    asyncio.create_task(initialize_project_background(project.id, project.name, body))
    
    return Project(
        id=project.id,
        name=project.name,
        description="AI will generate description based on your prompt...",
        status=project.status,
        preview_url=project.preview_url,
        created_at=project.created_at,
        last_active_at=project.last_active_at,
        last_message_at=None,
        services={
            "github": {"connected": False, "status": "disconnected"},
            "supabase": {"connected": False, "status": "disconnected"},
            "vercel": {"connected": False, "status": "disconnected"}
        },
        features=[],
        tech_stack=["Next.js", "React", "TypeScript"],
        ai_generated=False,  # Will be updated after AI processing
        initial_prompt=project.initial_prompt
    )


@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str, 
    body: ProjectUpdate, 
    db: Session = Depends(get_db)
) -> Project:
    """Update a project"""
    
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update project name
    project.name = body.name
    db.commit()
    db.refresh(project)
    
    # Get last message time
    last_message = db.query(Message).filter(
        Message.project_id == project_id
    ).order_by(desc(Message.created_at)).first()
    
    # Get service connections
    services = {}
    service_connections = db.query(ProjectServiceConnection).filter(
        ProjectServiceConnection.project_id == project.id
    ).all()
    
    for conn in service_connections:
        services[conn.provider] = {
            "connected": True,
            "status": conn.status
        }
    
    # Ensure all service types are represented
    for provider in ["github", "supabase", "vercel"]:
        if provider not in services:
            services[provider] = {
                "connected": False,
                "status": "disconnected"
            }
    
    # Extract AI-generated info from settings
    ai_info = project.settings or {}
    
    return Project(
        id=project.id,
        name=project.name,
        description=ai_info.get('description'),
        status=project.status or "idle",
        preview_url=project.preview_url,
        created_at=project.created_at,
        last_active_at=project.last_active_at,
        last_message_at=last_message.created_at if last_message else None,
        services=services,
        features=ai_info.get('features'),
        tech_stack=ai_info.get('tech_stack'),
        ai_generated=ai_info.get('ai_generated', False),
        initial_prompt=project.initial_prompt,
        preferred_cli=project.preferred_cli,
        selected_model=project.selected_model
    )


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project"""
    
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated messages
    db.query(Message).filter(Message.project_id == project_id).delete()
    
    # Delete service connections
    db.query(ProjectServiceConnection).filter(
        ProjectServiceConnection.project_id == project_id
    ).delete()
    
    # Delete project
    db.delete(project)
    db.commit()
    
    # Clean up project files from disk
    try:
        from app.services.project.initializer import cleanup_project
        cleanup_success = await cleanup_project(project_id)
        if cleanup_success:
            print(f"✅ Project files deleted successfully for {project_id}")
        else:
            print(f"⚠️ Project files may not have been fully deleted for {project_id}")
    except Exception as e:
        print(f"❌ Error cleaning up project files for {project_id}: {e}")
        # Don't fail the whole operation if file cleanup fails
    
    return {"message": f"Project {project_id} deleted successfully"}
