"""Git operations endpoints for projects."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.services import git_ops

router = APIRouter()


class GitCommitRequest(BaseModel):
    message: str


class GitPushRequest(BaseModel):
    remote: str = "origin"
    branch: Optional[str] = None


class GitPullRequest(BaseModel):
    remote: str = "origin"
    branch: Optional[str] = None


class GitBranchRequest(BaseModel):
    branch_name: str
    checkout: bool = True


@router.get("/{project_id}/git/status")
async def get_git_status(project_id: str, db: Session = Depends(get_db)):
    """Get git status for a project"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        status = git_ops.get_status(project.repo_path)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/git/branches")
async def get_git_branches(project_id: str, db: Session = Depends(get_db)):
    """Get git branches for a project"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        branches = git_ops.get_branches(project.repo_path)
        return branches
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/git/commit")
async def commit_changes(
    project_id: str,
    request: GitCommitRequest,
    db: Session = Depends(get_db)
):
    """Commit all changes"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        commit_sha = git_ops.commit_all(project.repo_path, request.message)
        return {"message": "Changes committed successfully", "commit_sha": commit_sha}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/git/push")
async def push_changes(
    project_id: str,
    request: GitPushRequest,
    db: Session = Depends(get_db)
):
    """Push changes to remote"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        result = git_ops.push(project.repo_path, request.remote, request.branch)
        return {"message": "Changes pushed successfully", "output": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/git/pull")
async def pull_changes(
    project_id: str,
    request: GitPullRequest,
    db: Session = Depends(get_db)
):
    """Pull changes from remote"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        result = git_ops.pull(project.repo_path, request.remote, request.branch)
        return {"message": "Changes pulled successfully", "output": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/git/branch")
async def create_git_branch(
    project_id: str,
    request: GitBranchRequest,
    db: Session = Depends(get_db)
):
    """Create a new branch"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        result = git_ops.create_branch(project.repo_path, request.branch_name, request.checkout)
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/git/checkout/{branch_name}")
async def checkout_git_branch(
    project_id: str,
    branch_name: str,
    db: Session = Depends(get_db)
):
    """Checkout a branch"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.repo_path:
        raise HTTPException(status_code=400, detail="Project has no repository path")

    try:
        result = git_ops.checkout_branch(project.repo_path, branch_name)
        return {"message": f"Switched to branch '{branch_name}'", "output": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))