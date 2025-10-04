from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.projects import router as projects_router
from app.api.repo import router as repo_router
from app.api.commits import router as commits_router
from app.api.env import router as env_router
from app.api.assets import router as assets_router
from app.api.chat import router as chat_router
from app.api.tokens import router as tokens_router
from app.api.ai import router as ai_router
from app.api.service_approvals import router as service_approvals_router
from app.api.config import router as config_router
from app.api.api_keys import router as api_keys_router
from app.api.settings import router as settings_router
from app.api.project_services import router as project_services_router
from app.api.github import router as github_router
from app.api.vercel import router as vercel_router
from app.api.users import router as users_router
from app.core.logging import configure_logging
from app.core.terminal_ui import ui
from app.core.enhanced_config import settings, validate_and_setup
from app.core.security_middleware import setup_security_middleware
from sqlalchemy import inspect
from app.db.base import Base
import app.models  # noqa: F401 ensures models are imported for metadata
from app.db.session import engine
from app.db.migrations import run_sqlite_migrations
import os

configure_logging()

# Validate configuration before starting
if not validate_and_setup():
    raise RuntimeError("Configuration validation failed")

app = FastAPI(
    title="Claudable API",
    description="AI-powered web application builder with bilateral approval system",
    version="2.0.0",
    docs_url="/docs" if settings.is_development() else None,
    redoc_url="/redoc" if settings.is_development() else None,
    openapi_url="/openapi.json" if settings.is_development() else None
)

# Setup security middleware
setup_security_middleware(app)

# Middleware to suppress logging for specific endpoints
class LogFilterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Suppress logging for polling endpoints
        if "/requests/active" in request.url.path:
            import logging
            logger = logging.getLogger("uvicorn.access")
            original_disabled = logger.disabled
            logger.disabled = True
            try:
                response = await call_next(request)
            finally:
                logger.disabled = original_disabled
        else:
            response = await call_next(request)
        return response

app.add_middleware(LogFilterMiddleware)

# Enhanced CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400  # 24 hours
)

# Routers
app.include_router(projects_router, prefix="/api/projects")
app.include_router(repo_router)
app.include_router(commits_router)
app.include_router(env_router)
app.include_router(assets_router)
app.include_router(chat_router, prefix="/api/chat")  # Unified chat API (includes WebSocket and ACT)
app.include_router(tokens_router)  # Service tokens API
app.include_router(ai_router)  # AI connectivity + simple chat
app.include_router(service_approvals_router)  # Bilateral approval system
app.include_router(config_router)  # API configuration endpoint
app.include_router(api_keys_router)  # API keys management
app.include_router(settings_router)  # Settings API
app.include_router(project_services_router)  # Project services API
app.include_router(github_router)  # GitHub integration API
app.include_router(vercel_router)  # Vercel integration API
app.include_router(users_router)  # Users API


@app.get("/health")
def health():
    # Health check (English comments only)
    return {"ok": True}


@app.on_event("startup")
def on_startup() -> None:
    # Auto create tables if not exist; production setups should use Alembic
    ui.info("Initializing database tables")
    inspector = inspect(engine)
    Base.metadata.create_all(bind=engine)
    ui.success("Database initialization complete")
    
    # Run lightweight SQLite migrations for additive changes
    if settings.database.database_type.value == "sqlite":
        run_sqlite_migrations(engine)
    
    # Show available endpoints
    ui.info("API server ready")
    ui.panel(
        "WebSocket: /api/chat/{project_id}\n"
        "REST API: /api/projects, /api/chat, /api/github, /api/vercel\n"
        "Service Approvals: /api/service-approvals\n"
        "AI Integration: /api/ai",
        title="Available Endpoints",
        style="green"
    )
    
    # Display ASCII logo after all initialization is complete
    ui.ascii_logo()
    
    # Show environment info
    env_info = {
        "Environment": settings.environment.value,
        "Debug": str(settings.debug),
        "Port": str(settings.api.api_port),
        "Database": settings.database.database_type.value,
        "Security": "Enhanced" if settings.is_production() else "Development"
    }
    ui.status_line(env_info)
    
    # Log startup completion
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Claudable API started successfully in {settings.environment.value} mode")
