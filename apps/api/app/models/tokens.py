"""
Service tokens model for storing access tokens (local development only)
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class ServiceToken(Base):
    __tablename__ = "service_tokens"

    id = Column(String(36), primary_key=True, index=True)
    provider = Column(String(50), nullable=False, index=True)  # github, supabase, vercel
    name = Column(String(255), nullable=False)  # User-defined name
    token = Column(Text, nullable=False)  # Plain text token (local only)
    is_active = Column(Boolean, default=True)  # New field for activation status
    
    # Security fields
    encrypted = Column(Boolean, default=False)
    encryption_key_id = Column(String(100), nullable=True)
    
    # Approval relationship
    approval_id = Column(String(36), ForeignKey("service_approvals.id"), nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)
    usage_count = Column(String(20), default="0")  # Track usage for monitoring
    
    # Relationships
    approval = relationship("ServiceApproval", back_populates="tokens")
    
    # Add unique constraint to prevent multiple tokens per provider (optional)
    # If you want to allow multiple tokens per provider, remove this
    __table_args__ = (
        # UniqueConstraint('provider', name='uq_provider_token'),
    )