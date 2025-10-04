"""
API Configuration endpoint for frontend
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os

router = APIRouter(prefix="/api/config", tags=["config"])


class APIConfigResponse(BaseModel):
    api_url: str
    web_url: str
    environment: str
    features: Dict[str, bool]
    services: Dict[str, bool]


@router.get("/", response_model=APIConfigResponse)
async def get_api_config(request: Request):
    """Get API configuration for frontend"""
    
    # Get base URL from request
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    
    return APIConfigResponse(
        api_url=os.getenv("API_URL", base_url),
        web_url=os.getenv("WEB_URL", base_url.replace(":8080", ":3000")),
        environment=os.getenv("ENVIRONMENT", "development"),
        features={
            "service_approvals": True,
            "ai_integration": True,
            "github_integration": bool(os.getenv("GITHUB_TOKEN")),
            "vercel_integration": bool(os.getenv("VERCEL_TOKEN")),
            "supabase_integration": bool(os.getenv("SUPABASE_URL")),
            "analytics": os.getenv("ENABLE_ANALYTICS", "true").lower() == "true",
            "error_reporting": os.getenv("ENABLE_ERROR_REPORTING", "true").lower() == "true",
        },
        services={
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "github": bool(os.getenv("GITHUB_TOKEN")),
            "vercel": bool(os.getenv("VERCEL_TOKEN")),
            "supabase": bool(os.getenv("SUPABASE_URL")),
        }
    )


@router.post("/set-api-url")
async def set_api_url(request: Request, api_url: str):
    """Set API URL for browser session"""
    # In a real implementation, you might store this in session/cookies
    return {
        "message": "API URL set successfully",
        "api_url": api_url,
        "status": "success"
    }


@router.post("/set-bearer-token")
async def set_bearer_token(request: Request, token: str):
    """Set bearer token for API authentication"""
    # In a real implementation, you might store this securely
    return {
        "message": "Bearer token set successfully",
        "status": "success"
    }