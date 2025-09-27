"""Endpoints for managing Claude CLI agent and command files."""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_db  # noqa: F401  # Needed for consistency with other modules

router = APIRouter()

CLAUDE_ROOT = Path.home() / ".claude"
RESOURCE_DIRS = {
    "agents": CLAUDE_ROOT / "agents",
    "commands": CLAUDE_ROOT / "commands",
}


class ClaudeFileResponse(BaseModel):
    name: str
    path: str
    absolute_path: str
    updated_at: float | None = None


class ClaudeFileContent(BaseModel):
    content: str


def _resolve_resource_path(resource: Literal["agents", "commands"], filename: str | Path) -> Path:
    base_dir = RESOURCE_DIRS[resource]
    target = (base_dir / filename).resolve()
    if not str(target).startswith(str(base_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file path")
    return target


def _list_resource(resource: Literal["agents", "commands"]) -> list[ClaudeFileResponse]:
    base_dir = RESOURCE_DIRS[resource]
    if not base_dir.exists():
        return []

    files: list[ClaudeFileResponse] = []
    for child in sorted(base_dir.iterdir()):
        # Only include .md files
        if child.is_file() and child.suffix == '.md':
            stat = child.stat()
            files.append(
                ClaudeFileResponse(
                    name=child.name,
                    path=child.relative_to(base_dir).as_posix(),
                    absolute_path=str(child),
                    updated_at=stat.st_mtime if stat else None,
                )
            )
    return files


@router.get("/claude/{resource}", response_model=list[ClaudeFileResponse])
async def list_claude_files(resource: Literal["agents", "commands"]):
    """List Claude agent or command files."""
    return _list_resource(resource)


@router.get("/claude/{resource}/{file_path:path}", response_model=ClaudeFileContent)
async def read_claude_file(resource: Literal["agents", "commands"], file_path: str):
    target = _resolve_resource_path(resource, file_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        return ClaudeFileContent(content=target.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not UTF-8 encoded")


@router.put("/claude/{resource}/{file_path:path}", response_model=ClaudeFileContent)
async def update_claude_file(
    resource: Literal["agents", "commands"],
    file_path: str,
    body: ClaudeFileContent,
):
    target = _resolve_resource_path(resource, file_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    target.write_text(body.content, encoding="utf-8")
    return body


__all__ = ["router"]
