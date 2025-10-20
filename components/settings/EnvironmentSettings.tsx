/**
 * Environment Settings Component
 * Manage environment variables
 */
import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret?: boolean;
}

interface EnvironmentSettingsProps {
  projectId: string;
}

export function EnvironmentSettings({ projectId }: EnvironmentSettingsProps) {
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadEnvironmentVariables = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setVariables(data || []);
      }
    } catch (error) {
      console.error('Failed to load environment variables:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEnvironmentVariables();
  }, [loadEnvironmentVariables]);

  const handleAdd = async () => {
    if (!newKey || !newValue) return;

    const newVar: EnvironmentVariable = {
      key: newKey,
      value: newValue,
      isSecret
    };

    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newVar.key,
          value: newVar.value,
          scope: 'runtime',
          var_type: 'string',
          is_secret: newVar.isSecret || false
        })
      });

      if (response.ok) {
        setVariables([...variables, newVar]);
        setNewKey('');
        setNewValue('');
        setIsSecret(false);
      }
    } catch (error) {
      console.error('Failed to add environment variable:', error);
    }
  };

  const handleUpdate = async (index: number, variable: EnvironmentVariable) => {
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}/${variable.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: variable.value })
      });

      if (response.ok) {
        const updated = [...variables];
        updated[index] = variable;
        setVariables(updated);
        setEditingIndex(null);
      }
    } catch (error) {
      console.error('Failed to update environment variable:', error);
    }
  };

  const handleDelete = async (index: number, key: string) => {
    if (!confirm(`Delete environment variable "${key}"?`)) return;

    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}/${key}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setVariables(variables.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error('Failed to delete environment variable:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Environment Variables
        </h3>

        {/* Variables List */}
        <div className="space-y-2 mb-6">
          {isLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : variables.length === 0 ? (
            <div className="text-gray-500 text-sm">No environment variables configured</div>
          ) : (
            variables.map((variable, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                {editingIndex === index ? (
                  <>
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => {
                        const updated = [...variables];
                        updated[index] = { ...variable, key: e.target.value };
                        setVariables(updated);
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                    />
                    <input
                      type={variable.isSecret ? 'password' : 'text'}
                      value={variable.value}
                      onChange={(e) => {
                        const updated = [...variables];
                        updated[index] = { ...variable, value: e.target.value };
                        setVariables(updated);
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      onClick={() => handleUpdate(index, variable)}
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {variable.key}
                    </span>
                    <span className="text-gray-400">=</span>
                    <span className="flex-1 font-mono text-sm text-gray-600 dark:text-gray-400">
                      {variable.isSecret ? '••••••••' : variable.value}
                    </span>
                    {variable.isSecret && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                        Secret
                      </span>
                    )}
                    <button
                      onClick={() => setEditingIndex(index)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(index, variable.key)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add New Variable */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Add New Variable
          </h4>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="KEY"
                value={newKey}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow letters, numbers, and underscores, convert to uppercase
                  const cleaned = value
                    .replace(/[^a-zA-Z0-9_]/g, '') // Remove invalid characters instead of replacing with _
                    .toUpperCase();
                  setNewKey(cleaned);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <input
                type={isSecret ? 'password' : 'text'}
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Mark as secret
                </span>
              </label>
              
              <button
                onClick={handleAdd}
                disabled={!newKey || !newValue}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Variable
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
