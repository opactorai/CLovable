"use client";

import { useState, useEffect } from 'react';


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface MCPServer {
  id: number;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  scope: 'user' | 'project';
  is_active: boolean;
  status?: { running: boolean; error?: string };
}

interface MCPServersTabProps {
  projectId: string;
}

export function MCPServersTab({ projectId }: MCPServersTabProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServers = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/mcp`);

      if (!response.ok) {
        throw new Error(`Failed to load MCP servers: ${response.statusText}`);
      }

      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load MCP servers');
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, [projectId]);

  const toggleServer = async (serverId: number) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    try {
      const endpoint = server.is_active ? 'stop' : 'start';
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/mcp/${serverId}/${endpoint}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} MCP server`);
      }

      // Reload servers to get updated status
      await loadServers();
    } catch (error) {
      console.error(`Failed to toggle MCP server:`, error);
      setError(error instanceof Error ? error.message : 'Failed to toggle MCP server');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading MCP servers...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="text-sm text-red-800 dark:text-red-300">
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={loadServers}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">MCP Servers</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enable or disable MCP servers for this project. Configure servers in Global Settings.
        </p>
      </div>

      {/* Servers List */}
      <div className="space-y-3">
        {servers.map((server) => (
          <div
            key={server.id}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{server.name}</h4>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {server.transport} transport
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                server.is_active
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {server.is_active ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={server.is_active}
                onChange={() => toggleServer(server.id)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Need to add more servers?</strong> Go to Global Settings → MCP to configure new MCP servers.
        </div>
      </div>
    </div>
  );
}