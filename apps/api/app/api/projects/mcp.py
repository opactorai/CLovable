"""MCP Server management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.models.mcp_servers import MCPServer as MCPServerModel
from app.services.mcp.manager import mcp_manager

router = APIRouter()


class MCPServerCreate(BaseModel):
    name: str
    transport: str  # "stdio" or "sse"
    command: Optional[str] = None
    args: Optional[List[str]] = None
    url: Optional[str] = None
    env: Optional[Dict[str, str]] = None
    scope: str = "project"  # "user" or "project"
    is_active: bool = False


class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    transport: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    url: Optional[str] = None
    env: Optional[Dict[str, str]] = None
    scope: Optional[str] = None
    is_active: Optional[bool] = None


class MCPServerResponse(BaseModel):
    id: int
    name: str
    transport: str
    command: Optional[str]
    args: Optional[List[str]]
    url: Optional[str]
    env: Optional[Dict[str, str]]
    scope: str
    is_active: bool
    status: Optional[Dict[str, Any]]


@router.get("/{project_id}/mcp", response_model=List[MCPServerResponse])
async def list_mcp_servers(project_id: str, db: Session = Depends(get_db)):
    """List MCP servers for a project."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    servers = db.query(MCPServerModel).filter(MCPServerModel.project_id == project_id).all()
    return [
        MCPServerResponse(
            id=server.id,
            name=server.name,
            transport=server.transport,
            command=server.command,
            args=server.args,
            url=server.url,
            env=server.env,
            scope=server.scope,
            is_active=server.is_active,
            status=server.status
        )
        for server in servers
    ]


@router.post("/{project_id}/mcp", response_model=MCPServerResponse)
async def create_mcp_server(
    project_id: str,
    server_data: MCPServerCreate,
    db: Session = Depends(get_db)
):
    """Create a new MCP server for a project."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate transport-specific fields
    if server_data.transport == "stdio":
        if not server_data.command:
            raise HTTPException(status_code=400, detail="Command required for stdio transport")
    elif server_data.transport == "sse":
        if not server_data.url:
            raise HTTPException(status_code=400, detail="URL required for sse transport")
    else:
        raise HTTPException(status_code=400, detail="Transport must be 'stdio' or 'sse'")

    server = MCPServerModel(
        project_id=project_id,
        name=server_data.name,
        transport=server_data.transport,
        command=server_data.command,
        args=server_data.args,
        url=server_data.url,
        env=server_data.env,
        scope=server_data.scope,
        is_active=server_data.is_active,
        status={"running": False}
    )

    db.add(server)
    db.commit()
    db.refresh(server)

    return MCPServerResponse(
        id=server.id,
        name=server.name,
        transport=server.transport,
        command=server.command,
        args=server.args,
        url=server.url,
        env=server.env,
        scope=server.scope,
        is_active=server.is_active,
        status=server.status
    )


@router.put("/{project_id}/mcp/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(
    project_id: str,
    server_id: int,
    server_data: MCPServerUpdate,
    db: Session = Depends(get_db)
):
    """Update an MCP server."""
    server = db.query(MCPServerModel).filter(
        MCPServerModel.id == server_id,
        MCPServerModel.project_id == project_id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Update fields
    for field, value in server_data.dict(exclude_unset=True).items():
        setattr(server, field, value)

    db.commit()
    db.refresh(server)

    return MCPServerResponse(
        id=server.id,
        name=server.name,
        transport=server.transport,
        command=server.command,
        args=server.args,
        url=server.url,
        env=server.env,
        scope=server.scope,
        is_active=server.is_active,
        status=server.status
    )


@router.delete("/{project_id}/mcp/{server_id}")
async def delete_mcp_server(
    project_id: str,
    server_id: int,
    db: Session = Depends(get_db)
):
    """Delete an MCP server."""
    server = db.query(MCPServerModel).filter(
        MCPServerModel.id == server_id,
        MCPServerModel.project_id == project_id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    db.delete(server)
    db.commit()

    return {"message": "MCP server deleted successfully"}


@router.post("/{project_id}/mcp/{server_id}/start")
async def start_mcp_server(
    project_id: str,
    server_id: int,
    db: Session = Depends(get_db)
):
    """Start an MCP server."""
    server = db.query(MCPServerModel).filter(
        MCPServerModel.id == server_id,
        MCPServerModel.project_id == project_id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    success = await mcp_manager.start_server(server, db)

    if success:
        return {"message": f"MCP server {server.name} started successfully", "status": server.status}
    else:
        raise HTTPException(status_code=500, detail="Failed to start MCP server")


@router.post("/{project_id}/mcp/{server_id}/stop")
async def stop_mcp_server(
    project_id: str,
    server_id: int,
    db: Session = Depends(get_db)
):
    """Stop an MCP server."""
    server = db.query(MCPServerModel).filter(
        MCPServerModel.id == server_id,
        MCPServerModel.project_id == project_id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    success = await mcp_manager.stop_server(server_id, db)

    if success:
        return {"message": f"MCP server {server.name} stopped successfully", "status": server.status}
    else:
        raise HTTPException(status_code=500, detail="Failed to stop MCP server")


@router.get("/{project_id}/mcp/{server_id}/tools")
async def get_mcp_server_tools(
    project_id: str,
    server_id: int,
    db: Session = Depends(get_db)
):
    """Get tools from a running MCP server."""
    server = db.query(MCPServerModel).filter(
        MCPServerModel.id == server_id,
        MCPServerModel.project_id == project_id
    ).first()

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    running_servers = mcp_manager.get_running_servers()
    if server_id in running_servers:
        tools = running_servers[server_id].tools
        return {
            "server_name": server.name,
            "tools": [{"name": t.name, "description": t.description, "input_schema": t.input_schema} for t in tools]
        }
    else:
        return {"server_name": server.name, "tools": []}