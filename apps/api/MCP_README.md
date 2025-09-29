# MCP (Model Context Protocol) Implementation

## Overview

This implementation provides a production-ready MCP server management system for Claudable. It supports:

- **stdio Transport**: Execute MCP servers as local processes
- **SSE Transport**: Connect to remote MCP servers via HTTP/SSE
- **Dynamic Tool Discovery**: Automatically discover and expose tools from managed servers
- **Claudable MCP Proxy**: Act as an MCP server that proxies tools from other servers

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Claudable MCP Server                   │
│            (Acts as unified MCP interface)              │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐              ┌──────▼─────────┐
│  MCP Manager   │              │  Database      │
│  (Lifecycle)   │              │  (Config)      │
└───────┬────────┘              └────────────────┘
        │
   ┌────┴─────┐
   │          │
┌──▼───┐  ┌──▼───┐
│stdio │  │ SSE  │
│Server│  │Server│
└──────┘  └──────┘
```

## Components

### 1. Database Model (`app/models/mcp_servers.py`)
- Stores MCP server configurations per project
- Tracks server status, tools, and connection details
- Supports both stdio and SSE transports

### 2. MCP Manager (`app/services/mcp/manager.py`)
- Manages server lifecycle (start/stop)
- Handles tool discovery
- Proxies tool calls to appropriate servers
- Supports both stdio and SSE transports

### 3. Claudable MCP Server (`app/services/mcp/server.py`)
- Acts as an MCP server for Claude Desktop
- Exposes management tools (list, start, stop servers)
- Proxies tools from managed MCP servers
- Provides unified interface to all tools

### 4. API Endpoints (`app/api/projects/mcp.py`)
- REST API for managing MCP servers
- CRUD operations with validation
- Start/stop server controls
- Tool discovery endpoints

### 5. Frontend Components
- `GlobalMCPConfig.tsx`: Global MCP server management UI
- `MCPServersTab.tsx`: Project-specific MCP server controls

## API Endpoints

### List MCP Servers
```
GET /api/projects/{project_id}/mcp
```

### Create MCP Server
```
POST /api/projects/{project_id}/mcp
Content-Type: application/json

{
  "name": "memory-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {},
  "scope": "project",
  "is_active": false
}
```

### Start MCP Server
```
POST /api/projects/{project_id}/mcp/{server_id}/start
```

### Stop MCP Server
```
POST /api/projects/{project_id}/mcp/{server_id}/stop
```

### Get Server Tools
```
GET /api/projects/{project_id}/mcp/{server_id}/tools
```

## Configuration

### stdio Transport Example
```json
{
  "name": "memory-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### SSE Transport Example
```json
{
  "name": "remote-mcp",
  "transport": "sse",
  "url": "https://mcp-server.example.com/sse",
  "env": {
    "API_KEY": "your-api-key"
  }
}
```

## Security Features

### Input Validation
- Server names validated for special characters
- Command whitelist (node, python, python3, npx, uvx)
- URL validation for SSE transport
- Field length limits enforced

### Error Handling
- Comprehensive try-catch blocks
- Detailed logging with context
- User-friendly error messages
- Automatic cleanup on failures

### Process Management
- Graceful shutdown with timeout
- Force kill as fallback
- Proper resource cleanup
- Process monitoring

## Logging

All MCP operations are logged with context:
```
[MCP] Starting MCP server: memory-server
[MCP] MCP server memory-server started with 3 tools
[MCP] Stopping MCP server: memory-server
```

Use `logger.info()`, `logger.warning()`, `logger.error()` for proper log levels.

## Production Deployment

### 1. Environment Variables
No specific environment variables required, but ensure:
- Database connection is configured
- Proper logging level set
- Resource limits configured

### 2. Database Migration
The `mcp_servers` table will be created automatically on startup.

### 3. Security Considerations
- **Command Execution**: Only whitelisted commands are allowed
- **Process Isolation**: Each MCP server runs in isolated process
- **Resource Limits**: Consider setting ulimits for spawned processes
- **Network Access**: SSE servers should use HTTPS in production
- **Environment Variables**: Sensitive env vars should be encrypted at rest

### 4. Monitoring
Monitor these metrics:
- Number of running MCP servers
- Failed server starts
- Tool call latency
- Process memory usage

### 5. Scaling
- MCP manager is singleton per API instance
- For multi-instance deployments, consider:
  - Shared state via Redis
  - Process affinity for server management
  - Load balancer sticky sessions

## Claude Desktop Integration

To use Claudable as an MCP server in Claude Desktop:

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "claudable": {
      "command": "python",
      "args": ["-m", "app.services.mcp.server"],
      "env": {}
    }
  }
}
```

This exposes:
- `claudable_list_mcp_servers`: List all managed servers
- `claudable_start_mcp_server`: Start a server by name
- `claudable_stop_mcp_server`: Stop a server by name
- All tools from running MCP servers (prefixed with server name)

## Development

### Running Tests
```bash
# Start API server
npm run dev:api

# Test MCP server creation
curl -X POST http://localhost:8080/api/projects/{project_id}/mcp \
  -H "Content-Type: application/json" \
  -d '{"name":"test","transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-memory"]}'

# Start the server
curl -X POST http://localhost:8080/api/projects/{project_id}/mcp/{server_id}/start

# Get tools
curl http://localhost:8080/api/projects/{project_id}/mcp/{server_id}/tools
```

### Debugging
Enable debug logging in `manager.py` and `server.py`:
```python
logger.setLevel(logging.DEBUG)
```

## Troubleshooting

### Server Fails to Start
- Check command is in whitelist
- Verify command exists in PATH
- Check environment variables
- Review server logs for errors

### Tools Not Discovered
- Ensure server supports MCP protocol
- Check JSON-RPC communication
- Verify timeout settings (increase if needed)
- Check server stdout for errors

### SSE Connection Issues
- Verify URL is accessible
- Check network connectivity
- Ensure SSL certificates valid
- Review server logs

## Future Enhancements

1. **Health Checks**: Periodic ping to verify server availability
2. **Auto-Restart**: Restart failed servers automatically
3. **Resource Limits**: CPU/memory limits per server
4. **Tool Caching**: Cache tool metadata for performance
5. **Metrics**: Prometheus metrics for monitoring
6. **Multi-tenancy**: User-level MCP servers
7. **Tool Aliases**: Rename tools to avoid conflicts
8. **Rate Limiting**: Prevent tool abuse

## Contributing

When adding new MCP features:
1. Update database models if needed
2. Add validation to Pydantic models
3. Implement in manager with error handling
4. Add API endpoints with proper status codes
5. Update frontend components
6. Add tests
7. Update this README

## License

See project LICENSE file.