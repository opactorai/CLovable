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
from app.api.settings import router as settings_router
from app.api.project_services import router as project_services_router
from app.api.github import router as github_router
from app.api.vercel import router as vercel_router
from app.core.logging import configure_logging
from app.core.terminal_ui import ui
from sqlalchemy import inspect
from app.db.base import Base
import app.models  # noqa: F401 ensures models are imported for metadata
from app.db.session import engine
from app.db.migrations import run_sqlite_migrations
import os

configure_logging()

app = FastAPI(title="Clovable API")

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

# Basic CORS for local development - support multiple ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Routers
app.include_router(projects_router, prefix="/api/projects")
app.include_router(repo_router)
app.include_router(commits_router)
app.include_router(env_router)
app.include_router(assets_router)
app.include_router(chat_router, prefix="/api/chat")  # Unified chat API (includes WebSocket and ACT)
app.include_router(tokens_router)  # Service tokens API
app.include_router(settings_router)  # Settings API
app.include_router(project_services_router)  # Project services API
app.include_router(github_router)  # GitHub integration API
app.include_router(vercel_router)  # Vercel integration API


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
    run_sqlite_migrations(engine)
    
    # Show available endpoints
    ui.info("API server ready")
    ui.panel(
        "WebSocket: /api/chat/{project_id}\nREST API: /api/projects, /api/chat, /api/github, /api/vercel",
        title="Available Endpoints",
        style="green"
    )
    
    # Display ASCII logo after all initialization is complete
    ui.ascii_logo()
    
    # Show environment info
    env_info = {
        "Environment": os.getenv("ENVIRONMENT", "development"),
        "Debug": os.getenv("DEBUG", "false"),
        "Port": os.getenv("PORT", "8000")
    }
    ui.status_line(env_info)
