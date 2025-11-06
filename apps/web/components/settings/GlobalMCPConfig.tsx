"use client";

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface MCPServer {
  id: number;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  status: 'inactive' | 'running' | 'error';
  tools?: Array<{ name: string; description: string }>;
}

export function GlobalMCPConfig() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServer, setEditingServer] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'sse',
    command: '',
    args: '',
    url: '',
    env: ''
  });
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      transport: 'stdio',
      command: '',
      args: '',
      url: '',
      env: ''
    });
  };

  const handleSave = () => {
    if (editingServer) {
      setServers(prev => prev.map(server =>
        server.id === editingServer
          ? {
              ...server,
              name: formData.name,
              command: formData.command,
              args: formData.args.split(' ').filter(Boolean),
              env: formData.env ? JSON.parse(formData.env) : {}
            }
          : server
      ));
      setEditingServer(null);
      showToast('MCP server updated successfully', 'success');
    } else {
      const newServer: MCPServer = {
        id: servers.length + 1,
        name: formData.name,
        transport: formData.transport,
        command: formData.command,
        args: formData.args.split(' ').filter(Boolean),
        url: formData.url || undefined,
        env: formData.env ? JSON.parse(formData.env) : {},
        status: 'inactive'
      };
      setServers(prev => [...prev, newServer]);
      setShowAddForm(false);
      showToast('MCP server added successfully', 'success');
    }
    resetForm();
  };

  const handleEdit = (server: MCPServer) => {
    setFormData({
      name: server.name,
      transport: server.transport,
      command: server.command || '',
      args: server.args?.join(' ') || '',
      url: server.url || '',
      env: JSON.stringify(server.env || {}, null, 2)
    });
    setEditingServer(server.id);
    setShowAddForm(false);
  };

  const handleDelete = (serverId: number) => {
    setServers(prev => prev.filter(server => server.id !== serverId));
    if (editingServer === serverId) {
      setEditingServer(null);
      resetForm();
    }
    showToast('MCP server deleted', 'success');
  };

  const handleStart = async (serverId: number) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    try {
      const isRunning = server.status === 'running';
      const endpoint = isRunning ? 'stop' : 'start';

      // For now, simulate API call with mock project ID
      const response = await fetch(`${API_BASE}/api/projects/mock-project/${endpoint}`, {
        method: 'POST'
      });

      if (response.ok) {
        setServers(prev => prev.map(s =>
          s.id === serverId
            ? { ...s, status: isRunning ? 'inactive' : 'running' }
            : s
        ));
        showToast(`MCP server ${server.name} ${isRunning ? 'stopped' : 'started'}`, 'success');
      }
    } catch (error) {
      showToast(`Failed to ${server.status === 'running' ? 'stop' : 'start'} ${server.name}`, 'error');
    }
  };

  const MCPForm = ({ isEditing = false }: { isEditing?: boolean }) => (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {isEditing ? 'Edit MCP Server' : 'Add New MCP Server'}
        </h4>
        <button
          onClick={() => {
            setShowAddForm(false);
            setEditingServer(null);
            resetForm();
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="My MCP Server"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Transport
          </label>
          <select
            value={formData.transport}
            onChange={(e) => setFormData({...formData, transport: e.target.value as 'stdio' | 'sse'})}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="stdio">stdio</option>
            <option value="sse">sse</option>
          </select>
        </div>

        {formData.transport === 'stdio' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Command
              </label>
              <input
                type="text"
                value={formData.command}
                onChange={(e) => setFormData({...formData, command: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="npx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Arguments
              </label>
              <input
                type="text"
                value={formData.args}
                onChange={(e) => setFormData({...formData, args: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="--yes mcp-server-name"
              />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="https://mcp.example.com/sse"
            />
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Environment Variables (JSON)
          </label>
          <textarea
            value={formData.env}
            onChange={(e) => setFormData({...formData, env: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder='{"API_KEY": "your-key"}'
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setShowAddForm(false);
            setEditingServer(null);
            resetForm();
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!formData.name || (formData.transport === 'stdio' && !formData.command) || (formData.transport === 'sse' && !formData.url)}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? 'Update' : 'Add'} Server
        </button>
      </div>
    </div>
  );

  const [hostEnabled, setHostEnabled] = useState(false);
  const [showHostConfig, setShowHostConfig] = useState(false);

  const toggleHost = () => {
    setHostEnabled(!hostEnabled);
    showToast(`Claudable MCP host ${!hostEnabled ? 'enabled' : 'disabled'}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">MCP Configuration</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure Model Context Protocol servers and host
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Server
        </button>
      </div>

      {/* Claudable MCP Host */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Claudable MCP Host</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                MCP server for CLI agents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 text-xs rounded-full ${
              hostEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {hostEnabled ? 'Running' : 'Stopped'}
            </span>

            <button
              onClick={() => setShowHostConfig(!showHostConfig)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Show config"
            >
              <svg className={`w-4 h-4 transition-transform ${showHostConfig ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hostEnabled}
                onChange={toggleHost}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {showHostConfig && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">Claude Desktop Configuration</h5>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Add this to your Claude Desktop config:
            </p>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`"claudable": {
  "command": "python",
  "args": ["-m", "app.services.mcp.server"],
  "env": {}
}`}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Add Form (at top) */}
      {showAddForm && !editingServer && <MCPForm />}

      {/* External MCP Servers */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">External MCP Servers</h4>
        <div className="space-y-3">
        {servers.map((server) => (
          <div key={server.id} className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{server.name}</h4>
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {server.transport === 'stdio' ? `${server.command} ${server.args?.join(' ')}` : server.url}
                  </div>
                </div>
                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {server.transport}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  server.status === 'running'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : server.status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {server.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStart(server.id)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    server.status === 'running'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }`}
                >
                  {server.status === 'running' ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={() => handleEdit(server)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tools Display (when server is running) */}
            {server.status === 'running' && server.tools && server.tools.length > 0 && (
              <div className="ml-11 mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Available Tools</h5>
                <div className="space-y-2">
                  {server.tools.map((tool, toolIndex) => (
                    <div key={toolIndex} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <div className="text-sm font-mono text-gray-900 dark:text-white">{tool.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Form (under specific server) */}
            {editingServer === server.id && <MCPForm isEditing={true} />}
          </div>
        ))}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg border text-white z-50 ${
          toast.type === 'success'
            ? 'bg-green-600 border-green-500'
            : 'bg-red-600 border-red-500'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}