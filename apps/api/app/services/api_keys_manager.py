"""
API Keys Management Service
"""
import os
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from sqlalchemy.sql import func

from app.models.tokens import ServiceToken
from app.models.service_approvals import ServiceApproval, ApprovalStatus, ServiceType
from app.core.enhanced_config import settings


class APIKeysManager:
    """Manages API keys storage and retrieval"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def save_api_key(self, service_type: str, key_name: str, api_key: str, 
                    description: str = "", user_id: str = "system") -> Dict[str, Any]:
        """Save an API key to the database"""
        try:
            # Check if key already exists
            existing_token = self.db.query(ServiceToken).filter(
                and_(
                    ServiceToken.provider == service_type,
                    ServiceToken.name == key_name
                )
            ).first()
            
            if existing_token:
                # Update existing token
                existing_token.token = api_key
                existing_token.updated_at = func.now()
                self.db.commit()
                return {
                    "success": True,
                    "message": "API key updated successfully",
                    "token_id": existing_token.id
                }
            else:
                # Create new token
                token_id = str(uuid.uuid4())
                new_token = ServiceToken(
                    id=token_id,
                    provider=service_type,
                    name=key_name,
                    token=api_key,
                    is_active=True,
                    encrypted=False,
                    usage_count="0"
                )
                
                self.db.add(new_token)
                self.db.commit()
                
                return {
                    "success": True,
                    "message": "API key saved successfully",
                    "token_id": token_id
                }
                
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "message": f"Failed to save API key: {str(e)}"
            }
    
    def get_api_key(self, service_type: str, key_name: str) -> Optional[str]:
        """Get an API key from the database"""
        try:
            token = self.db.query(ServiceToken).filter(
                and_(
                    ServiceToken.provider == service_type,
                    ServiceToken.name == key_name,
                    ServiceToken.is_active == True
                )
            ).first()
            
            return token.token if token else None
            
        except Exception as e:
            print(f"Error retrieving API key: {str(e)}")
            return None
    
    def get_all_api_keys(self, service_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all API keys, optionally filtered by service type"""
        try:
            query = self.db.query(ServiceToken).filter(ServiceToken.is_active == True)
            
            if service_type:
                query = query.filter(ServiceToken.provider == service_type)
            
            tokens = query.all()
            
            return [
                {
                    "id": token.id,
                    "provider": token.provider,
                    "name": token.name,
                    "is_active": token.is_active,
                    "created_at": token.created_at.isoformat() if token.created_at else None,
                    "last_used": token.last_used.isoformat() if token.last_used else None,
                    "usage_count": token.usage_count
                }
                for token in tokens
            ]
            
        except Exception as e:
            print(f"Error retrieving API keys: {str(e)}")
            return []
    
    def delete_api_key(self, token_id: str) -> Dict[str, Any]:
        """Delete an API key"""
        try:
            token = self.db.query(ServiceToken).filter(ServiceToken.id == token_id).first()
            
            if not token:
                return {
                    "success": False,
                    "message": "API key not found"
                }
            
            token.is_active = False
            self.db.commit()
            
            return {
                "success": True,
                "message": "API key deleted successfully"
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "message": f"Failed to delete API key: {str(e)}"
            }
    
    def update_api_key_usage(self, token_id: str, success: bool = True) -> None:
        """Update API key usage statistics"""
        try:
            token = self.db.query(ServiceToken).filter(ServiceToken.id == token_id).first()
            
            if token:
                # Update usage count
                current_count = int(token.usage_count) if token.usage_count else 0
                token.usage_count = str(current_count + 1)
                
                # Update last used timestamp
                token.last_used = func.now()
                
                self.db.commit()
                
        except Exception as e:
            print(f"Error updating API key usage: {str(e)}")
    
    def get_environment_api_keys(self) -> Dict[str, str]:
        """Get API keys from environment variables"""
        return {
            "openai": os.getenv("OPENAI_API_KEY", ""),
            "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
            "github": os.getenv("GITHUB_TOKEN", ""),
            "vercel": os.getenv("VERCEL_TOKEN", ""),
            "supabase_url": os.getenv("SUPABASE_URL", ""),
            "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", ""),
            "supabase_service_role_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        }
    
    def sync_environment_to_database(self) -> Dict[str, Any]:
        """Sync environment API keys to database"""
        try:
            env_keys = self.get_environment_api_keys()
            synced_count = 0
            
            for service_type, api_key in env_keys.items():
                if api_key and api_key != "your_openai_key_here" and api_key != "your_anthropic_key_here":
                    result = self.save_api_key(
                        service_type=service_type,
                        key_name=f"env_{service_type}",
                        api_key=api_key,
                        description=f"Synced from environment variable"
                    )
                    if result["success"]:
                        synced_count += 1
            
            return {
                "success": True,
                "message": f"Synced {synced_count} API keys from environment",
                "synced_count": synced_count
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to sync environment keys: {str(e)}"
            }