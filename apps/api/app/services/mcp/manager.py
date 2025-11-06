"""
MCP Server Manager
Manages MCP server processes and tool discovery
"""
import asyncio
import json
import subprocess
import signal
import os
import aiohttp
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.models.mcp_servers import MCPServer as MCPServerModel
from app.core.terminal_ui import ui


@dataclass
class MCPTool:
    name: str
    description: str
    input_schema: Dict[str, Any]


@dataclass
class MCPServerProcess:
    model: MCPServerModel
    process: Optional[subprocess.Popen]
    tools: List[MCPTool]
    error: Optional[str]
    sse_session: Optional[aiohttp.ClientSession] = None
    sse_url: Optional[str] = None


class MCPManager:
    """Manages MCP server processes and tool discovery"""

    def __init__(self):
        self.running_servers: Dict[int, MCPServerProcess] = {}

    async def start_server(self, server_model: MCPServerModel, db: Session) -> bool:
        """Start an MCP server and discover its tools"""
        try:
            if server_model.id in self.running_servers:
                # Already running
                return True

            ui.info(f"Starting MCP server: {server_model.name}", "MCP")

            # Build command
            if server_model.transport == "stdio":
                if not server_model.command:
                    raise ValueError("Command required for stdio transport")

                cmd = [server_model.command]
                if server_model.args:
                    cmd.extend(server_model.args)

                # Set up environment
                env = os.environ.copy()
                if server_model.env:
                    env.update(server_model.env)

                # Start process
                process = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env,
                    text=True
                )

                # Give it a moment to start
                await asyncio.sleep(1)

                # Check if process is still running
                if process.poll() is not None:
                    stdout, stderr = process.communicate()
                    error_msg = f"Process failed to start: {stderr or stdout}"
                    ui.error(error_msg, "MCP")

                    # Update database status
                    server_model.status = {"running": False, "error": error_msg}
                    db.commit()
                    return False

                # Discover tools
                tools = await self._discover_tools(process, server_model.name)

                # Store running server
                self.running_servers[server_model.id] = MCPServerProcess(
                    model=server_model,
                    process=process,
                    tools=tools,
                    error=None
                )

                # Update database status
                server_model.status = {"running": True, "tools": [{"name": t.name, "description": t.description} for t in tools]}
                server_model.is_active = True
                db.commit()

                ui.success(f"MCP server {server_model.name} started with {len(tools)} tools", "MCP")
                return True

            elif server_model.transport == "sse":
                if not server_model.url:
                    raise ValueError("URL required for SSE transport")

                ui.info(f"Connecting to SSE MCP server: {server_model.name}", "MCP")

                # Create SSE client session
                timeout = aiohttp.ClientTimeout(total=30, connect=10)
                session = aiohttp.ClientSession(timeout=timeout)

                try:
                    # Test connection
                    async with session.get(server_model.url) as response:
                        if response.status != 200:
                            raise ValueError(f"SSE server returned status {response.status}")

                    # Discover tools via SSE
                    tools = await self._discover_tools_sse(session, server_model.url, server_model.name)

                    # Store running server
                    self.running_servers[server_model.id] = MCPServerProcess(
                        model=server_model,
                        process=None,
                        tools=tools,
                        error=None,
                        sse_session=session,
                        sse_url=server_model.url
                    )

                    # Update database status
                    server_model.status = {"running": True, "tools": [{"name": t.name, "description": t.description} for t in tools]}
                    server_model.is_active = True
                    db.commit()

                    ui.success(f"MCP server {server_model.name} connected with {len(tools)} tools", "MCP")
                    return True

                except Exception as e:
                    await session.close()
                    raise e

        except Exception as e:
            error_msg = f"Failed to start MCP server {server_model.name}: {str(e)}"
            ui.error(error_msg, "MCP")

            # Update database status
            server_model.status = {"running": False, "error": error_msg}
            db.commit()
            return False

    async def stop_server(self, server_id: int, db: Session) -> bool:
        """Stop an MCP server"""
        try:
            if server_id not in self.running_servers:
                return True  # Already stopped

            server_process = self.running_servers[server_id]
            ui.info(f"Stopping MCP server: {server_process.model.name}", "MCP")

            # Handle stdio transport
            if server_process.process:
                # Terminate process
                server_process.process.terminate()

                # Wait for graceful shutdown
                try:
                    server_process.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Force kill if needed
                    server_process.process.kill()
                    server_process.process.wait()

            # Handle SSE transport
            if server_process.sse_session:
                await server_process.sse_session.close()

            # Remove from running servers
            del self.running_servers[server_id]

            # Update database status
            server_process.model.status = {"running": False}
            server_process.model.is_active = False
            db.commit()

            ui.success(f"MCP server {server_process.model.name} stopped", "MCP")
            return True

        except Exception as e:
            error_msg = f"Failed to stop MCP server: {str(e)}"
            ui.error(error_msg, "MCP")
            return False

    async def _discover_tools(self, process: subprocess.Popen, server_name: str) -> List[MCPTool]:
        """Discover tools from an MCP server process"""
        try:
            # Send list_tools request
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
                "params": {}
            }

            request_json = json.dumps(request) + "\n"

            if process.stdin:
                process.stdin.write(request_json)
                process.stdin.flush()

            # Read response (with timeout)
            if process.stdout:
                try:
                    response_line = await asyncio.wait_for(
                        asyncio.to_thread(process.stdout.readline),
                        timeout=10.0
                    )

                    if response_line:
                        response = json.loads(response_line.strip())

                        if "result" in response and "tools" in response["result"]:
                            tools = []
                            for tool_data in response["result"]["tools"]:
                                tools.append(MCPTool(
                                    name=tool_data.get("name", "unknown"),
                                    description=tool_data.get("description", ""),
                                    input_schema=tool_data.get("inputSchema", {})
                                ))
                            return tools

                except asyncio.TimeoutError:
                    ui.warning(f"Timeout discovering tools for {server_name}", "MCP")
                except json.JSONDecodeError:
                    ui.warning(f"Invalid JSON response from {server_name}", "MCP")

            return []

        except Exception as e:
            ui.error(f"Error discovering tools for {server_name}: {str(e)}", "MCP")
            return []

    async def _discover_tools_sse(self, session: aiohttp.ClientSession, url: str, server_name: str) -> List[MCPTool]:
        """Discover tools from an SSE MCP server"""
        try:
            # Send list_tools request
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
                "params": {}
            }

            async with session.post(url, json=request, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    ui.warning(f"SSE server returned status {response.status} for tools/list", "MCP")
                    return []

                result = await response.json()

                if "result" in result and "tools" in result["result"]:
                    tools = []
                    for tool_data in result["result"]["tools"]:
                        tools.append(MCPTool(
                            name=tool_data.get("name", "unknown"),
                            description=tool_data.get("description", ""),
                            input_schema=tool_data.get("inputSchema", {})
                        ))
                    return tools

            return []

        except asyncio.TimeoutError:
            ui.warning(f"Timeout discovering tools for SSE server {server_name}", "MCP")
            return []
        except Exception as e:
            ui.error(f"Error discovering tools for SSE server {server_name}: {str(e)}", "MCP")
            return []

    def get_running_servers(self) -> Dict[int, MCPServerProcess]:
        """Get all currently running servers"""
        return self.running_servers.copy()

    def get_all_tools(self) -> List[tuple[str, MCPTool]]:
        """Get all tools from all running servers"""
        all_tools = []
        for server_id, server_process in self.running_servers.items():
            server_name = server_process.model.name
            for tool in server_process.tools:
                # Prefix tool names with server name
                prefixed_name = f"{server_name}__{tool.name}"
                all_tools.append((prefixed_name, tool))
        return all_tools

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on an MCP server"""
        try:
            # Parse server and tool name
            if "__" not in tool_name:
                raise ValueError("Tool name must be in format 'server__tool'")

            server_name, actual_tool_name = tool_name.split("__", 1)

            # Find running server
            server_process = None
            for sp in self.running_servers.values():
                if sp.model.name == server_name:
                    server_process = sp
                    break

            if not server_process:
                raise ValueError(f"Server {server_name} is not running")

            # Send tool call request
            request = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": actual_tool_name,
                    "arguments": arguments
                }
            }

            # Handle stdio transport
            if server_process.process:
                request_json = json.dumps(request) + "\n"

                if server_process.process.stdin:
                    server_process.process.stdin.write(request_json)
                    server_process.process.stdin.flush()

                # Read response
                if server_process.process.stdout:
                    response_line = await asyncio.wait_for(
                        asyncio.to_thread(server_process.process.stdout.readline),
                        timeout=30.0
                    )

                    if response_line:
                        response = json.loads(response_line.strip())
                        return response.get("result", {})

                return {"error": "No response from server"}

            # Handle SSE transport
            elif server_process.sse_session and server_process.sse_url:
                async with server_process.sse_session.post(
                    server_process.sse_url,
                    json=request,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status != 200:
                        return {"error": f"SSE server returned status {response.status}"}

                    result = await response.json()
                    return result.get("result", {})

            else:
                return {"error": "Server has no valid transport"}

        except asyncio.TimeoutError:
            return {"error": f"Timeout calling tool {tool_name}"}
        except Exception as e:
            return {"error": f"Failed to call tool {tool_name}: {str(e)}"}


# Global MCP manager instance
mcp_manager = MCPManager()