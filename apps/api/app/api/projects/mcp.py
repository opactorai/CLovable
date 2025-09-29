"""MCP Server management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, validator, Field
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging

from app.api.deps import get_db
from app.models.projects import Project as ProjectModel
from app.models.mcp_servers import MCPServer as MCPServerModel
from app.services.mcp.manager import mcp_manager

router = APIRouter()
logger = logging.getLogger(__name__)


class MCPServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Server name")
    transport: str = Field(..., pattern="^(stdio|sse)$", description="Transport type: stdio or sse")
    command: Optional[str] = Field(None, max_length=512, description="Command for stdio transport")
    args: Optional[List[str]] = Field(None, description="Arguments for stdio transport")
    url: Optional[str] = Field(None, max_length=512, description="URL for SSE transport")
    env: Optional[Dict[str, str]] = Field(None, description="Environment variables")
    scope: str = Field("project", pattern="^(user|project)$", description="Scope: user or project")
    is_active: bool = Field(False, description="Whether server should start automatically")

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Server name cannot be empty')
        # Prevent special characters that could cause issues
        if any(c in v for c in ['/', '\\', '..', '<', '>', '|', '&', ';']):
            raise ValueError('Server name contains invalid characters')
        return v.strip()

    @validator('command')
    def validate_command(cls, v, values):
        if values.get('transport') == 'stdio' and not v:
            raise ValueError('Command is required for stdio transport')
        # Basic command validation - only allow known safe commands
        if v:
            cmd = v.strip().split()[0] if v.strip() else ''
            allowed_commands = ['node', 'python', 'python3', 'npx', 'uvx']
            if cmd not in allowed_commands:
                logger.warning(f"Command '{cmd}' is not in allowed list: {allowed_commands}")
        return v

    @validator('url')
    def validate_url(cls, v, values):
        if values.get('transport') == 'sse' and not v:
            raise ValueError('URL is required for SSE transport')
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v


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
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            logger.warning(f"Project not found: {project_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        servers = db.query(MCPServerModel).filter(MCPServerModel.project_id == project_id).all()
        logger.info(f"Listed {len(servers)} MCP servers for project {project_id}")

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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing MCP servers for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list MCP servers"
        )


@router.post("/{project_id}/mcp", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_server(
    project_id: str,
    server_data: MCPServerCreate,
    db: Session = Depends(get_db)
):
    """Create a new MCP server for a project."""
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            logger.warning(f"Project not found: {project_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        # Check for duplicate server names within the project
        existing = db.query(MCPServerModel).filter(
            MCPServerModel.project_id == project_id,
            MCPServerModel.name == server_data.name
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"MCP server with name '{server_data.name}' already exists for this project"
            )

        # Additional validation is done by Pydantic model
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

        logger.info(f"Created MCP server '{server.name}' for project {project_id}")

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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating MCP server for project {project_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create MCP server"
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
    try:
        server = db.query(MCPServerModel).filter(
            MCPServerModel.id == server_id,
            MCPServerModel.project_id == project_id
        ).first()

        if not server:
            logger.warning(f"MCP server not found: {server_id} for project {project_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP server not found")

        logger.info(f"Starting MCP server: {server.name} (ID: {server_id})")
        success = await mcp_manager.start_server(server, db)

        if success:
            logger.info(f"MCP server {server.name} started successfully")
            return {"message": f"MCP server {server.name} started successfully", "status": server.status}
        else:
            error_msg = server.status.get("error", "Unknown error") if server.status else "Unknown error"
            logger.error(f"Failed to start MCP server {server.name}: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start MCP server: {error_msg}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting MCP server {server_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start MCP server"
        )


@router.post("/{project_id}/mcp/{server_id}/stop")
async def stop_mcp_server(
    project_id: str,
    server_id: int,
    db: Session = Depends(get_db)
):
    """Stop an MCP server."""
    try:
        server = db.query(MCPServerModel).filter(
            MCPServerModel.id == server_id,
            MCPServerModel.project_id == project_id
        ).first()

        if not server:
            logger.warning(f"MCP server not found: {server_id} for project {project_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP server not found")

        logger.info(f"Stopping MCP server: {server.name} (ID: {server_id})")
        success = await mcp_manager.stop_server(server_id, db)

        if success:
            logger.info(f"MCP server {server.name} stopped successfully")
            return {"message": f"MCP server {server.name} stopped successfully", "status": server.status}
        else:
            logger.error(f"Failed to stop MCP server {server.name}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to stop MCP server"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping MCP server {server_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop MCP server"
        )


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