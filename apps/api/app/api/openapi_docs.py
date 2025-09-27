"""
OpenAPI Documentation and Configuration
Enhances API routes with detailed descriptions, examples, and tags
"""
from typing import Any, Dict
from fastapi import FastAPI

# Tag descriptions for better organization
TAGS_METADATA = [
    {
        "name": "projects",
        "description": "Operations for managing projects including creation, updates, and status tracking",
    },
    {
        "name": "chat",
        "description": "WebSocket and REST endpoints for chat sessions with Claude and other AI models",
    },
    {
        "name": "commits",
        "description": "Git commit management and tracking",
    },
    {
        "name": "environment",
        "description": "Environment variable management for projects",
    },
    {
        "name": "assets",
        "description": "File and asset management within projects",
    },
    {
        "name": "tokens",
        "description": "Service token management for external integrations",
    },
    {
        "name": "settings",
        "description": "Application and project settings",
    },
    {
        "name": "github",
        "description": "GitHub integration endpoints for repositories and authentication",
    },
    {
        "name": "vercel",
        "description": "Vercel deployment and project management",
    },
    {
        "name": "claude",
        "description": "Claude conversation and file management",
    },
    {
        "name": "health",
        "description": "Health check and monitoring endpoints",
    }
]

def configure_openapi(app: FastAPI) -> None:
    """Configure OpenAPI with enhanced documentation"""

    # Update the OpenAPI schema with tags
    app.openapi_tags = TAGS_METADATA

    # Store original openapi method
    original_openapi = app.openapi

    # Add custom OpenAPI configuration
    def custom_openapi() -> Dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        # Call the original openapi method, not the custom one
        openapi_schema = original_openapi()

        # Add server information
        openapi_schema["servers"] = [
            {"url": "http://localhost:8000", "description": "Development server"},
            {"url": "http://127.0.0.1:8000", "description": "Local server"}
        ]

        # Add external documentation
        openapi_schema["externalDocs"] = {
            "description": "Clovable API Documentation",
            "url": "https://github.com/your-org/clovable"
        }

        # Add security schemes if needed
        if "components" not in openapi_schema:
            openapi_schema["components"] = {}
        if "securitySchemes" not in openapi_schema["components"]:
            openapi_schema["components"]["securitySchemes"] = {}

        openapi_schema["components"]["securitySchemes"]["bearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token authentication"
        }

        # Cache the schema
        app.openapi_schema = openapi_schema
        return openapi_schema

    app.openapi = custom_openapi

# Response examples for common models
PROJECT_EXAMPLE = {
    "id": "my-awesome-project",
    "name": "My Awesome Project",
    "description": "A web application built with React and FastAPI",
    "status": "active",
    "preview_url": "http://localhost:3000",
    "created_at": "2024-01-01T00:00:00Z",
    "last_active_at": "2024-01-01T12:00:00Z",
    "services": {
        "github": {"connected": True, "status": "connected"},
        "vercel": {"connected": False, "status": "disconnected"}
    },
    "features": ["Authentication", "Real-time chat", "File upload"],
    "tech_stack": ["React", "TypeScript", "FastAPI", "PostgreSQL"],
    "initial_prompt": "Build a modern web application",
    "preferred_cli": "claude",
    "selected_model": "claude-3-opus"
}

MESSAGE_EXAMPLE = {
    "id": "msg_123",
    "project_id": "my-awesome-project",
    "role": "user",
    "content": "Can you help me add authentication?",
    "created_at": "2024-01-01T12:00:00Z",
    "metadata": {
        "model": "claude-3-opus",
        "tokens": 150
    }
}

def get_operation_metadata(path: str, method: str) -> Dict[str, Any]:
    """Get enhanced operation metadata for specific endpoints"""

    operations = {
        ("/api/projects", "get"): {
            "summary": "List all projects",
            "description": "Retrieve a list of all projects with their current status, service connections, and metadata",
            "responses": {
                200: {
                    "description": "List of projects retrieved successfully",
                    "content": {
                        "application/json": {
                            "example": [PROJECT_EXAMPLE]
                        }
                    }
                }
            }
        },
        ("/api/projects", "post"): {
            "summary": "Create a new project",
            "description": "Create a new project with specified configuration. This will initialize the project directory and set up the development environment.",
            "responses": {
                200: {
                    "description": "Project created successfully",
                    "content": {
                        "application/json": {
                            "example": PROJECT_EXAMPLE
                        }
                    }
                },
                409: {
                    "description": "Project with this ID already exists"
                }
            }
        },
        ("/api/projects/{project_id}", "get"): {
            "summary": "Get project details",
            "description": "Retrieve detailed information about a specific project including its configuration, status, and connected services",
            "responses": {
                200: {
                    "description": "Project details retrieved successfully",
                    "content": {
                        "application/json": {
                            "example": PROJECT_EXAMPLE
                        }
                    }
                },
                404: {
                    "description": "Project not found"
                }
            }
        },
        ("/api/chat/{project_id}", "websocket"): {
            "summary": "WebSocket chat endpoint",
            "description": "Establish a WebSocket connection for real-time chat with AI models. Supports streaming responses and tool calls.",
            "parameters": [
                {
                    "name": "project_id",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                    "description": "The project ID to establish chat session for"
                }
            ]
        }
    }

    key = (path, method.lower())
    return operations.get(key, {})