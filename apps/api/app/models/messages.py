"""
Unified message model for all chat, Claude Code SDK, and tool interactions
"""
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON, Integer, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class Message(Base):
    """Unified message table for all interactions"""
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    
    # Message Type & Role
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # user, assistant, system, tool
    message_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # chat, thinking, tool_use, tool_result, error
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Metadata - flexible JSON storage for various message types
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    # Threading & Session
    parent_message_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    
    # Performance & Cost Tracking
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    
    # Git Integration
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    
    # CLI Source Tracking
    cli_source: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)  # claude, cursor
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="messages")
    parent_message = relationship("Message", remote_side=[id], backref="replies")
    session = relationship("Session", back_populates="messages")