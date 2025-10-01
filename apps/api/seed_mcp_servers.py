"""
Seed script to add default MCP servers to all existing projects
"""
import sys
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.projects import Project
from app.models.mcp_servers import MCPServer

DEFAULT_MCP_SERVERS = [
    {
        "name": "Memory Server",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "scope": "project",
        "is_active": False,
    },
    {
        "name": "Fetch MCP",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "fetch-mcp"],
        "scope": "project",
        "is_active": False,
    },
    {
        "name": "Filesystem Server",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
        "scope": "project",
        "is_active": False,
    },
]


def seed_mcp_servers():
    """Add default MCP servers to all projects"""
    db: Session = SessionLocal()

    try:
        # Get all projects
        projects = db.query(Project).all()
        print(f"Found {len(projects)} projects")

        for project in projects:
            print(f"\nProcessing project: {project.name} ({project.id})")

            # Check existing servers for this project
            existing_servers = db.query(MCPServer).filter(
                MCPServer.project_id == project.id
            ).all()
            existing_names = {s.name for s in existing_servers}

            # Add missing default servers
            added_count = 0
            for server_config in DEFAULT_MCP_SERVERS:
                if server_config["name"] not in existing_names:
                    server = MCPServer(
                        project_id=project.id,
                        name=server_config["name"],
                        transport=server_config["transport"],
                        command=server_config["command"],
                        args=server_config["args"],
                        scope=server_config["scope"],
                        is_active=server_config["is_active"],
                        status={"running": False}
                    )
                    db.add(server)
                    added_count += 1
                    print(f"  ✓ Added: {server_config['name']}")
                else:
                    print(f"  - Skipped (exists): {server_config['name']}")

            if added_count > 0:
                db.commit()
                print(f"  Added {added_count} servers to {project.name}")

        print("\n✅ Seeding complete!")

    except Exception as e:
        print(f"\n❌ Error seeding MCP servers: {str(e)}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_mcp_servers()