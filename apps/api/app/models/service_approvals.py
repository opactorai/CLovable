"""
Service approval model for bilateral approval system
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ServiceType(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GITHUB = "github"
    VERCEL = "vercel"
    SUPABASE = "supabase"
    GOOGLE = "google"
    QWEN = "qwen"


class ServiceApproval(Base):
    __tablename__ = "service_approvals"

    id = Column(String(36), primary_key=True, index=True)
    service_type = Column(SQLEnum(ServiceType), nullable=False, index=True)
    service_name = Column(String(255), nullable=False)  # User-defined name
    description = Column(Text, nullable=True)  # What this service will be used for
    
    # Approval workflow
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING, index=True)
    requested_by = Column(String(255), nullable=False)  # User who requested
    approved_by = Column(String(255), nullable=True)  # Admin who approved
    rejected_by = Column(String(255), nullable=True)  # Admin who rejected
    
    # Service configuration
    configuration_data = Column(Text, nullable=True)  # JSON string of service config
    scopes = Column(Text, nullable=True)  # JSON string of requested scopes
    
    # Security and audit
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(Text, nullable=True)
    risk_level = Column(String(20), default="medium")  # low, medium, high, critical
    
    # Timestamps
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    tokens = relationship("ServiceToken", back_populates="approval", cascade="all, delete-orphan")


class ServiceUsageLog(Base):
    __tablename__ = "service_usage_logs"

    id = Column(String(36), primary_key=True, index=True)
    token_id = Column(String(36), ForeignKey("service_tokens.id"), nullable=False)
    service_type = Column(SQLEnum(ServiceType), nullable=False)
    
    # Request details
    endpoint = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    request_size = Column(String(20), nullable=True)  # Size in bytes
    response_size = Column(String(20), nullable=True)
    
    # Response details
    status_code = Column(String(10), nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Security
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    duration_ms = Column(String(20), nullable=True)  # Request duration