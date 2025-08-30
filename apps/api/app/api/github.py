"""
GitHub integration API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
import logging

from app.api.deps import get_db
from app.models.projects import Project
from app.models.project_services import ProjectServiceConnection
from app.services.github_service import GitHubService, GitHubAPIError, check_repo_availability
from app.services.token_service import get_token
from app.services.git_ops import (
    add_remote, 
    push_to_remote, 
    initialize_main_branch, 
    set_git_config,
    commit_all
)
from uuid import uuid4

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["github"])


class GitHubConnectRequest(BaseModel):
    repo_name: str
    description: str = ""
    private: bool = False


class GitHubConnectResponse(BaseModel):
    success: bool
    repo_url: str
    message: str


class GitPushResponse(BaseModel):
    success: bool
    message: str
    branch: Optional[str] = None


@router.get("/github/check-repo/{repo_name}")
async def check_repository_availability(repo_name: str, db: Session = Depends(get_db)):
    """Check if a GitHub repository name is available"""
    
    # Get GitHub token
    github_token = get_token(db, "github")
    if not github_token:
        raise HTTPException(status_code=401, detail="GitHub token not configured")
    
    try:
        result = await check_repo_availability(github_token, repo_name)
        
        if "error" in result:
            if "Invalid" in result["error"]:
                raise HTTPException(status_code=401, detail=result["error"])
            else:
                raise HTTPException(status_code=500, detail=result["error"])
        
        if result["exists"]:
            raise HTTPException(status_code=409, detail=f"Repository '{repo_name}' already exists")
        
        return {"available": True, "username": result["username"]}
        
    except GitHubAPIError as e:
        if e.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        else:
            raise HTTPException(status_code=e.status_code or 500, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking repository availability: {e}")
        raise HTTPException(status_code=500, detail="Failed to check repository availability")


@router.post("/projects/{project_id}/github/connect", response_model=GitHubConnectResponse)
async def connect_github_repository(
    project_id: str, 
    request: GitHubConnectRequest,
    db: Session = Depends(get_db)
):
    """Create GitHub repository and connect it to the project"""
    
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get GitHub token
    github_token = get_token(db, "github")
    if not github_token:
        raise HTTPException(status_code=401, detail="GitHub token not configured. Please add your GitHub token in Global Settings.")
    
    try:
        # Initialize GitHub service
        github_service = GitHubService(github_token)
        
        # Validate token and get user info
        user_info = await github_service.check_token_validity()
        if not user_info.get("valid"):
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        
        username = user_info["username"]
        user_name = user_info.get("name") or username
        user_email = user_info.get("email") or f"{username}@users.noreply.github.com"
        
        # Create GitHub repository
        repo_result = await github_service.create_repository(
            repo_name=request.repo_name,
            description=request.description,
            private=request.private,
            auto_init=False  # We'll push our existing code
        )
        
        if not repo_result.get("success"):
            raise HTTPException(status_code=500, detail="Failed to create GitHub repository")
        
        # Get repository info
        repo_url = repo_result["repo_url"]
        clone_url = repo_result["clone_url"]
        default_branch = repo_result.get("default_branch", "main")
        
        # Setup local Git repository
        # Try different path patterns
        if project.repo_path and os.path.exists(project.repo_path):
            # Use project repo path directly
            repo_path = project.repo_path
        elif project.repo_path and os.path.exists(os.path.join(project.repo_path, "repo")):
            # Use repo subfolder
            repo_path = os.path.join(project.repo_path, "repo")
        else:
            # Use standard project structure: ./data/projects/{project_id}/repo
            from pathlib import Path
            root_dir = Path(__file__).parent.parent.parent.parent  # Get to cc-lovable root
            repo_path = root_dir / "data" / "projects" / project.id / "repo"
            repo_path = str(repo_path.resolve())
            
            if not os.path.exists(repo_path):
                raise HTTPException(
                    status_code=500, 
                    detail=f"Project repository not found at expected path: {repo_path}"
                )
        
        if not repo_path or not os.path.exists(repo_path):
            raise HTTPException(status_code=500, detail=f"Could not create or find project repository path: {repo_path}")
        
        # Update project repo_path in database if it was changed
        if project.repo_path != repo_path:
            project.repo_path = repo_path
            db.commit()
        
        try:
            # Set Git config
            set_git_config(repo_path, user_name, user_email)
            
            # Initialize main branch and ensure we have commits
            initialize_main_branch(repo_path)
            
            # Create authenticated URL with DB token
            authenticated_url = clone_url.replace(
                "https://github.com/", 
                f"https://{username}:{github_token}@github.com/"
            )
            
            # Add remote origin with authentication
            add_remote(repo_path, "origin", authenticated_url)
            
            # Commit any pending changes
            commit_result = commit_all(repo_path, "Initial commit - connected to GitHub")
            if not commit_result.get("success") and "nothing to commit" not in str(commit_result.get("error", "")):
                logger.warning(f"Commit failed: {commit_result.get('error')}")
            
            # NOTE: Do not push on connect. Publishing will be triggered explicitly from UI.
            
        except Exception as git_error:
            logger.error(f"Git operations failed: {git_error}")
            # Repository was created but Git setup failed
            raise HTTPException(
                status_code=500, 
                detail=f"GitHub repository created successfully at {repo_url}, but local Git setup failed: {str(git_error)}. You may need to connect manually."
            )
        
        # Save service connection to database
        try:
            # Check if GitHub connection already exists
            existing_connection = db.query(ProjectServiceConnection).filter(
                ProjectServiceConnection.project_id == project_id,
                ProjectServiceConnection.provider == "github"
            ).first()
            
            service_data = {
                "repo_url": repo_url,
                "repo_name": request.repo_name,
                "clone_url": clone_url,
                "ssh_url": repo_result.get("ssh_url"),
                "default_branch": default_branch,
                "private": request.private,
                "username": username,
                "full_name": repo_result.get("full_name"),
                "repo_id": repo_result.get("repo_id")
            }
            
            if existing_connection:
                # Update existing connection
                existing_connection.service_data = service_data
                existing_connection.status = "connected"
                db.commit()
            else:
                # Create new connection
                connection = ProjectServiceConnection(
                    id=str(uuid4()),
                    project_id=project_id,
                    provider="github",
                    status="connected",
                    service_data=service_data
                )
                db.add(connection)
                db.commit()
                
        except Exception as db_error:
            logger.error(f"Database update failed: {db_error}")
            # Don't fail the operation for database issues
            
        return GitHubConnectResponse(
            success=True,
            repo_url=repo_url,
            message=f"GitHub repository '{request.repo_name}' created and connected successfully!"
        )
        
    except GitHubAPIError as e:
        logger.error(f"GitHub API error: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in GitHub connection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect GitHub repository: {str(e)}")


@router.get("/projects/{project_id}/github/status")
async def get_github_connection_status(project_id: str, db: Session = Depends(get_db)):
    """Get GitHub connection status for a project"""
    
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get GitHub connection
    connection = db.query(ProjectServiceConnection).filter(
        ProjectServiceConnection.project_id == project_id,
        ProjectServiceConnection.provider == "github"
    ).first()
    
    if not connection:
        return {"connected": False, "status": "disconnected"}
    
    return {
        "connected": True,
        "status": connection.status,
        "service_data": connection.service_data or {},
        "created_at": connection.created_at.isoformat(),
        "updated_at": connection.updated_at.isoformat() if connection.updated_at else None
    }


@router.delete("/projects/{project_id}/github/disconnect")
async def disconnect_github_repository(project_id: str, db: Session = Depends(get_db)):
    """Disconnect GitHub repository from project (does not delete the GitHub repo)"""
    
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find GitHub connection
    connection = db.query(ProjectServiceConnection).filter(
        ProjectServiceConnection.project_id == project_id,
        ProjectServiceConnection.provider == "github"
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="GitHub connection not found")
    
    # Remove the connection
    db.delete(connection)
    db.commit()
    
    return {"message": "GitHub repository disconnected successfully"}


@router.post("/projects/{project_id}/github/push", response_model=GitPushResponse)
async def push_github_repository(project_id: str, db: Session = Depends(get_db)):
    """Push current repo to remote origin. Used by Publish/Update in UI."""
    # Check project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Ensure GitHub connected
    connection = db.query(ProjectServiceConnection).filter(
        ProjectServiceConnection.project_id == project_id,
        ProjectServiceConnection.provider == "github"
    ).first()
    if not connection:
        raise HTTPException(status_code=400, detail="GitHub repository not connected")

    # Determine repo path
    repo_path = None
    if project.repo_path and os.path.exists(project.repo_path):
        repo_path = project.repo_path
    elif project.repo_path and os.path.exists(os.path.join(project.repo_path, "repo")):
        repo_path = os.path.join(project.repo_path, "repo")
    else:
        from pathlib import Path
        root_dir = Path(__file__).parent.parent.parent.parent
        candidate = root_dir / "data" / "projects" / project.id / "repo"
        if candidate.exists():
            repo_path = str(candidate.resolve())

    if not repo_path or not os.path.exists(repo_path):
        raise HTTPException(status_code=500, detail="Local repository path not found")

    # Branch: GitHub may return null for default_branch on empty repos.
    # Normalize to 'main' and persist after first successful push.
    default_branch = connection.service_data.get("default_branch") or "main"

    # Commit any pending changes (optional harmless)
    commit_all(repo_path, "Publish from Lovable UI")

    # Push
    result = push_to_remote(repo_path, "origin", default_branch)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=f"Git push failed: {result.get('error', 'unknown')}")

    # Update metadata on connections for UI (published flag)
    try:
        from datetime import datetime
        # Update GitHub connection record
        svc = connection
        data = svc.service_data or {}
        data.update({
            "last_push_at": datetime.utcnow().isoformat() + "Z",
            "last_pushed_branch": default_branch,
        })
        # Ensure default_branch is set after first push
        if not data.get("default_branch"):
            data["default_branch"] = default_branch
        svc.service_data = data
        db.commit()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed updating GitHub connection after push: {e}")

    # If Vercel connected, ensure we store computed deployment URL for convenience
    try:
        vercel_conn = db.query(ProjectServiceConnection).filter(
            ProjectServiceConnection.project_id == project_id,
            ProjectServiceConnection.provider == "vercel"
        ).first()
        if vercel_conn:
            vercel_data = vercel_conn.service_data or {}
            # Don't set deployment_url until actual deployment happens
            vercel_data["last_published_at"] = data.get("last_push_at")
            vercel_conn.service_data = vercel_data
            db.commit()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed updating Vercel connection after push: {e}")

    return GitPushResponse(success=True, message="Pushed to GitHub", branch=default_branch)
