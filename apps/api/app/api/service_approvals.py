"""
Service approval API endpoints for bilateral approval system
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.api.deps import get_db
from app.services.service_approval_manager import ServiceApprovalManager
from app.models.service_approvals import ServiceApproval, ServiceUsageLog, ApprovalStatus, ServiceType
from app.models.tokens import ServiceToken


router = APIRouter(prefix="/api/service-approvals", tags=["service-approvals"])


class ServiceAccessRequest(BaseModel):
    service_type: ServiceType
    service_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10, max_length=1000)
    configuration_data: Optional[Dict[str, Any]] = None
    scopes: Optional[List[str]] = None
    risk_level: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class ApprovalResponse(BaseModel):
    id: str
    service_type: str
    service_name: str
    description: str
    status: str
    requested_by: str
    approved_by: Optional[str] = None
    rejected_by: Optional[str] = None
    requested_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    risk_level: str
    configuration_data: Optional[Dict[str, Any]] = None
    scopes: Optional[List[str]] = None


class ApprovalAction(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class ServiceTokenResponse(BaseModel):
    id: str
    provider: str
    name: str
    is_active: bool
    encrypted: bool
    created_at: datetime
    last_used: Optional[datetime] = None
    usage_count: str


class UsageStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    period_days: int


def get_client_info(request: Request) -> tuple[str, str]:
    """Extract client IP and user agent"""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    return ip_address, user_agent


@router.post("/request", response_model=ApprovalResponse)
async def request_service_access(
    body: ServiceAccessRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request access to an external service"""
    
    # In a real implementation, you'd get the user from authentication
    requested_by = "current_user"  # Replace with actual user identification
    
    ip_address, user_agent = get_client_info(request)
    
    manager = ServiceApprovalManager(db)
    
    try:
        approval = manager.request_service_access(
            service_type=body.service_type,
            service_name=body.service_name,
            description=body.description,
            requested_by=requested_by,
            configuration_data=body.configuration_data,
            scopes=body.scopes,
            ip_address=ip_address,
            user_agent=user_agent,
            risk_level=body.risk_level
        )
        
        # In production, you might want to send notifications here
        # background_tasks.add_task(send_approval_notification, approval.id)
        
        return ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending", response_model=List[ApprovalResponse])
async def get_pending_approvals(db: Session = Depends(get_db)):
    """Get all pending approval requests (admin only)"""
    
    manager = ServiceApprovalManager(db)
    approvals = manager.get_pending_approvals()
    
    return [
        ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        for approval in approvals
    ]


@router.post("/{approval_id}/approve", response_model=ApprovalResponse)
async def approve_service_access(
    approval_id: str,
    body: ApprovalAction,
    db: Session = Depends(get_db)
):
    """Approve a service access request (admin only)"""
    
    # In a real implementation, you'd verify admin permissions
    approved_by = "admin_user"  # Replace with actual admin identification
    
    manager = ServiceApprovalManager(db)
    
    try:
        approval = manager.approve_service_access(
            approval_id=approval_id,
            approved_by=approved_by,
            reason=body.reason
        )
        
        return ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/reject", response_model=ApprovalResponse)
async def reject_service_access(
    approval_id: str,
    body: ApprovalAction,
    db: Session = Depends(get_db)
):
    """Reject a service access request (admin only)"""
    
    # In a real implementation, you'd verify admin permissions
    rejected_by = "admin_user"  # Replace with actual admin identification
    
    manager = ServiceApprovalManager(db)
    
    try:
        approval = manager.reject_service_access(
            approval_id=approval_id,
            rejected_by=rejected_by,
            reason=body.reason
        )
        
        return ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-approvals", response_model=List[ApprovalResponse])
async def get_my_approvals(db: Session = Depends(get_db)):
    """Get current user's approval requests"""
    
    # In a real implementation, you'd get the user from authentication
    user = "current_user"  # Replace with actual user identification
    
    manager = ServiceApprovalManager(db)
    approvals = manager.get_user_approvals(user)
    
    return [
        ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        for approval in approvals
    ]


@router.get("/my-approved-services", response_model=List[ApprovalResponse])
async def get_my_approved_services(db: Session = Depends(get_db)):
    """Get current user's approved services"""
    
    # In a real implementation, you'd get the user from authentication
    user = "current_user"  # Replace with actual user identification
    
    manager = ServiceApprovalManager(db)
    approvals = manager.get_approved_services(user)
    
    return [
        ApprovalResponse(
            id=approval.id,
            service_type=approval.service_type.value,
            service_name=approval.service_name,
            description=approval.description,
            status=approval.status.value,
            requested_by=approval.requested_by,
            approved_by=approval.approved_by,
            rejected_by=approval.rejected_by,
            requested_at=approval.requested_at,
            approved_at=approval.approved_at,
            rejected_at=approval.rejected_at,
            expires_at=approval.expires_at,
            risk_level=approval.risk_level,
            configuration_data=approval.configuration_data,
            scopes=approval.scopes
        )
        for approval in approvals
    ]


@router.post("/{approval_id}/create-token", response_model=ServiceTokenResponse)
async def create_service_token(
    approval_id: str,
    token_value: str,
    db: Session = Depends(get_db)
):
    """Create a service token after approval"""
    
    manager = ServiceApprovalManager(db)
    
    try:
        token = manager.create_service_token(
            approval_id=approval_id,
            token_value=token_value,
            encrypted=False  # In production, implement encryption
        )
        
        return ServiceTokenResponse(
            id=token.id,
            provider=token.provider,
            name=token.name,
            is_active=token.is_active,
            encrypted=token.encrypted,
            created_at=token.created_at,
            last_used=token.last_used,
            usage_count=token.usage_count
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tokens/{token_id}/usage-stats", response_model=UsageStatsResponse)
async def get_token_usage_stats(
    token_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get usage statistics for a service token"""
    
    manager = ServiceApprovalManager(db)
    
    try:
        stats = manager.get_service_usage_stats(token_id, days)
        return UsageStatsResponse(**stats)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{approval_id}/revoke")
async def revoke_service_access(
    approval_id: str,
    db: Session = Depends(get_db)
):
    """Revoke access to a service (admin only)"""
    
    # In a real implementation, you'd verify admin permissions
    revoked_by = "admin_user"  # Replace with actual admin identification
    
    manager = ServiceApprovalManager(db)
    
    try:
        approval = manager.revoke_service_access(approval_id, revoked_by)
        return {"message": "Service access revoked successfully", "approval_id": approval.id}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))