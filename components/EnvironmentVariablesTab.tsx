"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface EnvVar {
  id: string;
  key: string;
  value: string;
  scope: string;
  var_type: string;
  is_secret: boolean;
  description?: string;
}

interface EnvironmentVariablesTabProps {
  projectId: string;
}

export default function EnvironmentVariablesTab({ projectId }: EnvironmentVariablesTabProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEnvVar, setNewEnvVar] = useState({ key: '', value: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const loadEnvVars = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setEnvVars(data);
      } else {
        console.error('Failed to load environment variables');
      }
    } catch (error) {
      console.error('Error loading environment variables:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEnvVars();
  }, [loadEnvVars]);

  const saveEnvVar = async (key: string, value: string, description?: string) => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value,
          scope: 'runtime',
          var_type: 'string',
          is_secret: true,
          description: description || undefined
        }),
      });

      if (response.ok) {
        setSaveStatus('saved');
        await loadEnvVars();
        setNewEnvVar({ key: '', value: '', description: '' });
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error saving environment variable:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateEnvVar = async (key: string, value: string) => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        setSaveStatus('saved');
        await loadEnvVars();
        setEditingId(null);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error updating environment variable:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEnvVar = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the environment variable "${key}"?`)) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const response = await fetch(`${API_BASE}/api/env/${projectId}/${key}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSaveStatus('saved');
        await loadEnvVars();
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error deleting environment variable:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEnvVar = () => {
    if (!newEnvVar.key || !newEnvVar.value) {
      alert('Both key and value are required');
      return;
    }

    if (envVars.some(env => env.key === newEnvVar.key)) {
      alert('Environment variable with this key already exists');
      return;
    }

    saveEnvVar(newEnvVar.key, newEnvVar.value, newEnvVar.description);
  };

  const handleUpdateEnvVar = (envVar: EnvVar, newValue: string) => {
    updateEnvVar(envVar.key, newValue);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Environment Variables</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage environment variables for your Next.js project. Changes are automatically synced to your .env file.
            </p>
          </div>
          
          {saveStatus !== 'idle' && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              saveStatus === 'saving' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
              saveStatus === 'saved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {saveStatus === 'saving' && (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              )}
              {saveStatus === 'saved' && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {saveStatus === 'error' && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              <span>
                {saveStatus === 'saving' ? 'Saving...' :
                 saveStatus === 'saved' ? 'Saved' :
                 'Error'}
              </span>
            </div>
          )}
        </div>

        {/* Add New Environment Variable */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Add New Variable</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key
              </label>
              <input
                type="text"
                value={newEnvVar.key}
                onChange={(e) => setNewEnvVar(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                placeholder="API_KEY"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-[#DE7356] focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Value
              </label>
              <input
                type="password"
                value={newEnvVar.value}
                onChange={(e) => setNewEnvVar(prev => ({ ...prev, value: e.target.value }))}
                placeholder="your-secret-value"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-[#DE7356] focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={newEnvVar.description}
              onChange={(e) => setNewEnvVar(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this variable"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#DE7356] focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Variables are encrypted and automatically synced to your .env file
            </div>
            <button
              onClick={handleAddEnvVar}
              disabled={isSaving || !newEnvVar.key || !newEnvVar.value}
              className="px-4 py-2 bg-[#DE7356] hover:bg-[#c95940] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            >
              Add Variable
            </button>
          </div>
        </div>

        {/* Environment Variables List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[#DE7356] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading environment variables...</p>
            </div>
          ) : envVars.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">🔧</div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">No environment variables configured</p>
              <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">Add your first variable above to get started</p>
            </div>
          ) : (
            <AnimatePresence>
              {envVars.map((envVar) => (
                <div key={envVar.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-mono text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {envVar.key}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {envVar.scope}
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        {editingId === envVar.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              defaultValue={envVar.value}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateEnvVar(envVar, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                  setEditingId(null);
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                                if (input) {
                                  handleUpdateEnvVar(envVar, input.value);
                                }
                              }}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border">
                            {"•".repeat(Math.min(envVar.value.length, 20))}
                          </div>
                        )}
                      </div>
                      
                      {envVar.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {envVar.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {editingId !== envVar.id && (
                        <>
                          <button
                            onClick={() => setEditingId(envVar.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteEnvVar(envVar.key)}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 dark:text-blue-400 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Environment Variables
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>• All variables are securely encrypted and stored</p>
                <p>• Changes are automatically synced to your project&apos;s .env file</p>
                <p>• Variables are available during build and runtime</p>
                <p>• Use NEXT_PUBLIC_ prefix for client-side variables</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
