"""MCP Server configuration model."""
from sqlalchemy import String, Boolean, JSON, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class MCPServer(Base):
    """MCP Server configuration."""
    __tablename__ = "mcp_servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True)

    # Server identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    transport: Mapped[str] = mapped_column(String(32), nullable=False)  # stdio, sse

    # Command configuration (for stdio transport)
    command: Mapped[str | None] = mapped_column(String(512), nullable=True)
    args: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # SSE configuration (for sse transport)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Environment variables
    env: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Configuration
    scope: Mapped[str] = mapped_column(String(32), default="project", nullable=False)  # user, project
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Status tracking
    status: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # { running: bool, error?: string }

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="mcp_servers")