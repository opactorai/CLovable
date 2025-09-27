#!/usr/bin/env python
"""
Minimal FastAPI app to test Swagger is working
"""
from fastapi import FastAPI
from typing import List
from pydantic import BaseModel
import uvicorn

# Create app with OpenAPI configuration
app = FastAPI(
    title="Clovable API",
    description="API for managing projects, chat sessions, and integrations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Sample model
class Project(BaseModel):
    id: str
    name: str
    description: str | None = None

# Sample endpoints with OpenAPI annotations
@app.get(
    "/health",
    summary="Health Check",
    description="Check if the API is running",
    tags=["health"]
)
def health():
    return {"status": "ok"}

@app.get(
    "/api/projects",
    response_model=List[Project],
    summary="List Projects",
    description="Get a list of all projects",
    tags=["projects"]
)
def list_projects():
    return [
        Project(id="project-1", name="Project 1", description="First project"),
        Project(id="project-2", name="Project 2", description="Second project")
    ]

@app.post(
    "/api/projects",
    response_model=Project,
    status_code=201,
    summary="Create Project",
    description="Create a new project",
    tags=["projects"]
)
def create_project(project: Project):
    return project

if __name__ == "__main__":
    print("\n🚀 Starting minimal test server...")
    print("\n📚 Swagger UI will be available at: http://localhost:8002/docs")
    print("📖 ReDoc will be available at: http://localhost:8002/redoc")
    print("📄 OpenAPI JSON will be available at: http://localhost:8002/openapi.json")
    print("\nPress Ctrl+C to stop the server\n")

    uvicorn.run(app, host="0.0.0.0", port=8002)