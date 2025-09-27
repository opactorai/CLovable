"""
Comprehensive error handling and security middleware
"""
import logging
import time
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import traceback
import uuid

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https:; "
            "font-src 'self' data:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Basic rate limiting middleware"""
    
    def __init__(self, app: ASGIApp, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = {}
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Clean old requests
        if client_ip in self.requests:
            self.requests[client_ip] = [
                req_time for req_time in self.requests[client_ip]
                if current_time - req_time < 60
            ]
        else:
            self.requests[client_ip] = []
        
        # Check rate limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.requests_per_minute} requests per minute allowed",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        # Add current request
        self.requests[client_ip].append(current_time)
        
        response = await call_next(request)
        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Comprehensive error handling middleware"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Add request ID to headers for tracing
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            
            # Log successful requests
            duration = time.time() - start_time
            logger.info(
                f"Request {request_id}: {request.method} {request.url.path} - "
                f"{response.status_code} - {duration:.3f}s"
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except HTTPException as e:
            # Handle FastAPI HTTP exceptions
            duration = time.time() - start_time
            logger.warning(
                f"Request {request_id}: {request.method} {request.url.path} - "
                f"HTTP {e.status_code}: {e.detail} - {duration:.3f}s"
            )
            
            return JSONResponse(
                status_code=e.status_code,
                content={
                    "error": "HTTP Error",
                    "message": e.detail,
                    "request_id": request_id,
                    "timestamp": datetime.utcnow().isoformat()
                },
                headers={"X-Request-ID": request_id}
            )
            
        except Exception as e:
            # Handle unexpected errors
            duration = time.time() - start_time
            error_id = str(uuid.uuid4())
            
            logger.error(
                f"Request {request_id}: {request.method} {request.url.path} - "
                f"Unexpected error {error_id}: {str(e)} - {duration:.3f}s",
                exc_info=True
            )
            
            # Log full traceback for debugging
            logger.error(f"Traceback for error {error_id}:\n{traceback.format_exc()}")
            
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred",
                    "request_id": request_id,
                    "error_id": error_id,
                    "timestamp": datetime.utcnow().isoformat()
                },
                headers={"X-Request-ID": request_id}
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for audit and monitoring"""
    
    async def dispatch(self, request: Request, call_next):
        # Extract request information
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        referer = request.headers.get("referer", "")
        
        # Log request start
        logger.info(
            f"Request started: {request.method} {request.url.path} "
            f"from {client_ip} - User-Agent: {user_agent[:100]}"
        )
        
        response = await call_next(request)
        
        # Log request completion
        logger.info(
            f"Request completed: {request.method} {request.url.path} "
            f"from {client_ip} - Status: {response.status_code}"
        )
        
        return response


class DatabaseHealthMiddleware(BaseHTTPMiddleware):
    """Check database connectivity on each request"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.last_check = datetime.utcnow()
        self.check_interval = timedelta(minutes=5)
        self.db_healthy = True
    
    async def dispatch(self, request: Request, call_next):
        # Only check database health periodically
        if datetime.utcnow() - self.last_check > self.check_interval:
            try:
                # Simple database health check
                from app.db.session import engine
                with engine.connect() as conn:
                    conn.execute("SELECT 1")
                self.db_healthy = True
                self.last_check = datetime.utcnow()
            except Exception as e:
                logger.error(f"Database health check failed: {e}")
                self.db_healthy = False
                self.last_check = datetime.utcnow()
        
        # Add database status to request state
        request.state.db_healthy = self.db_healthy
        
        response = await call_next(request)
        
        # Add database status to response headers
        response.headers["X-Database-Status"] = "healthy" if self.db_healthy else "unhealthy"
        
        return response


class CORSConfigMiddleware(BaseHTTPMiddleware):
    """Enhanced CORS configuration for production"""
    
    def __init__(self, app: ASGIApp, allowed_origins: list = None):
        super().__init__(app)
        self.allowed_origins = allowed_origins or ["http://localhost:3000", "http://localhost:8080"]
    
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            if origin in self.allowed_origins:
                response = Response()
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID"
                response.headers["Access-Control-Max-Age"] = "86400"
                return response
            else:
                return JSONResponse(
                    status_code=403,
                    content={"error": "CORS policy violation", "message": "Origin not allowed"}
                )
        
        response = await call_next(request)
        
        # Add CORS headers to response
        if origin in self.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response


def setup_security_middleware(app):
    """Setup all security middleware in the correct order"""
    
    # Order matters - add middleware in reverse order of execution
    app.add_middleware(CORSConfigMiddleware)
    app.add_middleware(DatabaseHealthMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
    app.add_middleware(SecurityHeadersMiddleware)
    
    logger.info("Security middleware setup completed")