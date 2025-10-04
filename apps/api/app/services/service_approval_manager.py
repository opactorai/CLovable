"""
Service approval management for bilateral approval system
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.service_approvals import ServiceApproval, ServiceUsageLog, ApprovalStatus, ServiceType
from app.models.tokens import ServiceToken


class ServiceApprovalManager:
    """Manages bilateral approval workflow for external service integrations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def request_service_access(
        self,
        service_type: ServiceType,
        service_name: str,
        description: str,
        requested_by: str,
        configuration_data: Optional[Dict[str, Any]] = None,
        scopes: Optional[List[str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        risk_level: str = "medium"
    ) -> ServiceApproval:
        """Request access to an external service"""
        
        # Check for existing pending requests
        existing = self.db.query(ServiceApproval).filter(
            and_(
                ServiceApproval.service_type == service_type,
                ServiceApproval.requested_by == requested_by,
                ServiceApproval.status == ApprovalStatus.PENDING
            )
        ).first()
        
        if existing:
            raise ValueError(f"Pending approval request already exists for {service_type.value}")
        
        approval = ServiceApproval(
            id=str(uuid.uuid4()),
            service_type=service_type,
            service_name=service_name,
            description=description,
            requested_by=requested_by,
            configuration_data=json.dumps(configuration_data) if configuration_data else None,
            scopes=json.dumps(scopes) if scopes else None,
            ip_address=ip_address,
            user_agent=user_agent,
            risk_level=risk_level,
            expires_at=datetime.utcnow() + timedelta(days=7)  # 7-day expiry
        )
        
        self.db.add(approval)
        self.db.commit()
        self.db.refresh(approval)
        
        return approval
    
    def approve_service_access(
        self,
        approval_id: str,
        approved_by: str,
        reason: Optional[str] = None
    ) -> ServiceApproval:
        """Approve a service access request"""
        
        approval = self.db.query(ServiceApproval).filter(
            ServiceApproval.id == approval_id
        ).first()
        
        if not approval:
            raise ValueError("Approval request not found")
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Approval request is not pending (status: {approval.status})")
        
        if approval.expires_at and approval.expires_at < datetime.utcnow():
            approval.status = ApprovalStatus.EXPIRED
            self.db.commit()
            raise ValueError("Approval request has expired")
        
        approval.status = ApprovalStatus.APPROVED
        approval.approved_by = approved_by
        approval.approved_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(approval)
        
        return approval
    
    def reject_service_access(
        self,
        approval_id: str,
        rejected_by: str,
        reason: Optional[str] = None
    ) -> ServiceApproval:
        """Reject a service access request"""
        
        approval = self.db.query(ServiceApproval).filter(
            ServiceApproval.id == approval_id
        ).first()
        
        if not approval:
            raise ValueError("Approval request not found")
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Approval request is not pending (status: {approval.status})")
        
        approval.status = ApprovalStatus.REJECTED
        approval.rejected_by = rejected_by
        approval.rejected_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(approval)
        
        return approval
    
    def get_pending_approvals(self) -> List[ServiceApproval]:
        """Get all pending approval requests"""
        return self.db.query(ServiceApproval).filter(
            ServiceApproval.status == ApprovalStatus.PENDING
        ).order_by(ServiceApproval.requested_at.desc()).all()
    
    def get_user_approvals(self, user: str) -> List[ServiceApproval]:
        """Get all approvals for a specific user"""
        return self.db.query(ServiceApproval).filter(
            ServiceApproval.requested_by == user
        ).order_by(ServiceApproval.requested_at.desc()).all()
    
    def get_approved_services(self, user: str) -> List[ServiceApproval]:
        """Get all approved services for a user"""
        return self.db.query(ServiceApproval).filter(
            and_(
                ServiceApproval.requested_by == user,
                ServiceApproval.status == ApprovalStatus.APPROVED
            )
        ).order_by(ServiceApproval.approved_at.desc()).all()
    
    def create_service_token(
        self,
        approval_id: str,
        token_value: str,
        encrypted: bool = False,
        encryption_key_id: Optional[str] = None
    ) -> ServiceToken:
        """Create a service token after approval"""
        
        approval = self.db.query(ServiceApproval).filter(
            ServiceApproval.id == approval_id
        ).first()
        
        if not approval:
            raise ValueError("Approval not found")
        
        if approval.status != ApprovalStatus.APPROVED:
            raise ValueError("Service must be approved before creating token")
        
        # Check if token already exists
        existing_token = self.db.query(ServiceToken).filter(
            ServiceToken.approval_id == approval_id
        ).first()
        
        if existing_token:
            raise ValueError("Token already exists for this approval")
        
        token = ServiceToken(
            id=str(uuid.uuid4()),
            approval_id=approval_id,
            provider=approval.service_type.value,
            name=approval.service_name,
            token=token_value,
            encrypted=encrypted,
            encryption_key_id=encryption_key_id
        )
        
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        
        return token
    
    def log_service_usage(
        self,
        token_id: str,
        service_type: ServiceType,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        request_size: Optional[str] = None,
        response_size: Optional[str] = None,
        duration_ms: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> ServiceUsageLog:
        """Log service usage for audit and monitoring"""
        
        log = ServiceUsageLog(
            id=str(uuid.uuid4()),
            token_id=token_id,
            service_type=service_type,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            success=success,
            error_message=error_message,
            request_size=request_size,
            response_size=response_size,
            duration_ms=duration_ms,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.db.add(log)
        
        # Update token usage count
        token = self.db.query(ServiceToken).filter(ServiceToken.id == token_id).first()
        if token:
            token.last_used = datetime.utcnow()
            token.usage_count = str(int(token.usage_count) + 1)
        
        self.db.commit()
        self.db.refresh(log)
        
        return log
    
    def get_service_usage_stats(self, token_id: str, days: int = 30) -> Dict[str, Any]:
        """Get usage statistics for a service token"""
        
        since_date = datetime.utcnow() - timedelta(days=days)
        
        logs = self.db.query(ServiceUsageLog).filter(
            and_(
                ServiceUsageLog.token_id == token_id,
                ServiceUsageLog.created_at >= since_date
            )
        ).all()
        
        total_requests = len(logs)
        successful_requests = len([log for log in logs if log.success])
        failed_requests = total_requests - successful_requests
        
        return {
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
            "success_rate": (successful_requests / total_requests * 100) if total_requests > 0 else 0,
            "period_days": days
        }
    
    def revoke_service_access(self, approval_id: str, revoked_by: str) -> ServiceApproval:
        """Revoke access to a service"""
        
        approval = self.db.query(ServiceApproval).filter(
            ServiceApproval.id == approval_id
        ).first()
        
        if not approval:
            raise ValueError("Approval not found")
        
        # Deactivate all tokens
        tokens = self.db.query(ServiceToken).filter(
            ServiceToken.approval_id == approval_id
        ).all()
        
        for token in tokens:
            token.is_active = False
        
        approval.status = ApprovalStatus.REJECTED
        approval.rejected_by = revoked_by
        approval.rejected_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(approval)
        
        return approval