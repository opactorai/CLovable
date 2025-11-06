"""
Claudable MCP Server
Acts as an MCP server that exposes tools from managed MCP servers
"""
import asyncio
import json
import subprocess
from typing import List, Dict, Any, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    ListToolsRequest,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
)
from sqlalchemy.orm import Session

from app.models.mcp_servers import MCPServer as MCPServerModel
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.mcp.manager import mcp_manager


class ClaudableMCPServer:
    """Claudable MCP Server that proxies tools from configured MCP servers"""

    def __init__(self):
        self.server = Server("claudable-mcp-server")
        self.managed_servers: Dict[str, Any] = {}
        self.available_tools: List[Tool] = []

    async def setup_handlers(self):
        """Setup MCP request handlers"""

        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            """List all available tools from managed MCP servers"""
            await self._refresh_tools()
            return self.available_tools

        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Call a tool from a managed MCP server"""
            try:
                if name.startswith('claudable_'):
                    return await self._handle_claudable_tools(name, arguments)
                elif '__' in name:
                    return await self._handle_proxied_tools(name, arguments)
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
            except Exception as e:
                return [TextContent(type="text", text=f"Error calling {name}: {str(e)}")]

    async def _refresh_tools(self):
        """Refresh available tools from all running MCP servers"""
        self.available_tools = []

        # Add Claudable management tools
        self.available_tools.extend([
            Tool(
                name="claudable_list_mcp_servers",
                description="List all MCP servers managed by Claudable",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["active", "inactive", "all"],
                            "description": "Filter by server status"
                        }
                    }
                }
            ),
            Tool(
                name="claudable_start_mcp_server",
                description="Start an MCP server",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "server_name": {
                            "type": "string",
                            "description": "Name of the server to start"
                        }
                    },
                    "required": ["server_name"]
                }
            ),
            Tool(
                name="claudable_stop_mcp_server",
                description="Stop an MCP server",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "server_name": {
                            "type": "string",
                            "description": "Name of the server to stop"
                        }
                    },
                    "required": ["server_name"]
                }
            )
        ])

        # Add tools from running MCP servers
        all_tools = mcp_manager.get_all_tools()
        for tool_name, tool_data in all_tools:
            self.available_tools.append(Tool(
                name=tool_name,
                description=tool_data.description,
                inputSchema=tool_data.input_schema
            ))

    async def _handle_claudable_tools(self, name: str, arguments: Dict[str, Any]) -> List[TextContent]:
        """Handle Claudable's own management tools"""
        if name == "claudable_list_mcp_servers":
            return await self._list_mcp_servers(arguments)
        elif name == "claudable_start_mcp_server":
            return await self._start_mcp_server(arguments)
        elif name == "claudable_stop_mcp_server":
            return await self._stop_mcp_server(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown Claudable tool: {name}")]

    async def _handle_proxied_tools(self, name: str, arguments: Dict[str, Any]) -> List[TextContent]:
        """Handle proxied tools from other MCP servers"""
        try:
            result = await mcp_manager.call_tool(name, arguments)

            if "error" in result:
                return [TextContent(
                    type="text",
                    text=f"Error calling {name}: {result['error']}"
                )]

            # Format the result as text
            result_text = json.dumps(result, indent=2)
            return [TextContent(type="text", text=result_text)]

        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Failed to call {name}: {str(e)}"
            )]

    async def _list_mcp_servers(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """List configured MCP servers"""
        try:
            db = SessionLocal()
            try:
                servers_query = db.query(MCPServerModel).all()

                servers = []
                for server in servers_query:
                    status = "active" if server.is_active else "inactive"
                    servers.append({
                        "id": server.id,
                        "name": server.name,
                        "status": status,
                        "transport": server.transport,
                        "command": server.command if server.transport == "stdio" else None,
                        "url": server.url if server.transport == "sse" else None
                    })

                status_filter = arguments.get("status", "all")
                if status_filter != "all":
                    servers = [s for s in servers if s["status"] == status_filter]

                return [TextContent(
                    type="text",
                    text=f"MCP Servers ({status_filter}):\n{json.dumps(servers, indent=2)}"
                )]
            finally:
                db.close()

        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Error listing MCP servers: {str(e)}"
            )]

    async def _start_mcp_server(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """Start an MCP server"""
        server_name = arguments.get("server_name")
        if not server_name:
            return [TextContent(type="text", text="Server name is required")]

        try:
            db = SessionLocal()
            try:
                server = db.query(MCPServerModel).filter(MCPServerModel.name == server_name).first()

                if not server:
                    return [TextContent(
                        type="text",
                        text=f"MCP server '{server_name}' not found"
                    )]

                success = await mcp_manager.start_server(server, db)

                if success:
                    return [TextContent(
                        type="text",
                        text=f"Successfully started MCP server: {server_name}"
                    )]
                else:
                    error_msg = server.status.get("error", "Unknown error") if server.status else "Unknown error"
                    return [TextContent(
                        type="text",
                        text=f"Failed to start MCP server: {error_msg}"
                    )]
            finally:
                db.close()

        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Error starting MCP server: {str(e)}"
            )]

    async def _stop_mcp_server(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """Stop an MCP server"""
        server_name = arguments.get("server_name")
        if not server_name:
            return [TextContent(type="text", text="Server name is required")]

        try:
            db = SessionLocal()
            try:
                server = db.query(MCPServerModel).filter(MCPServerModel.name == server_name).first()

                if not server:
                    return [TextContent(
                        type="text",
                        text=f"MCP server '{server_name}' not found"
                    )]

                success = await mcp_manager.stop_server(server.id, db)

                if success:
                    return [TextContent(
                        type="text",
                        text=f"Successfully stopped MCP server: {server_name}"
                    )]
                else:
                    return [TextContent(
                        type="text",
                        text=f"Failed to stop MCP server: {server_name}"
                    )]
            finally:
                db.close()

        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Error stopping MCP server: {str(e)}"
            )]

    async def run(self):
        """Run the Claudable MCP server"""
        await self.setup_handlers()

        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="claudable-mcp-server",
                    server_version="1.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """Main entry point for the Claudable MCP server"""
    server = ClaudableMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())