"use client";

import { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Upload, Download, Plus, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface GitStatus {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  clean: boolean;
  error?: string;
}

interface GitBranches {
  current: string;
  local: string[];
  remote: string[];
  error?: string;
}

interface GitTabProps {
  projectId: string;
}

export function GitTab({ projectId }: GitTabProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranches | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadGitInfo = async () => {
    try {
      setLoading(true);
      const [statusRes, branchesRes] = await Promise.all([
        fetch(`${API_BASE}/api/projects/${projectId}/git/status`),
        fetch(`${API_BASE}/api/projects/${projectId}/git/branches`)
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        setBranches(branchesData);
      }
    } catch (error) {
      console.error('Failed to load git info:', error);
    } finally {
      setLoading(false);
    }
  };

  const commitChanges = async () => {
    if (!commitMessage.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage })
      });

      if (response.ok) {
        setCommitMessage('');
        loadGitInfo();
        showToast('Changes committed successfully', 'success');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to commit', 'error');
      }
    } catch (error) {
      showToast('Failed to commit changes', 'error');
    }
  };

  const pushChanges = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin' })
      });

      if (response.ok) {
        showToast('Changes pushed successfully', 'success');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to push', 'error');
      }
    } catch (error) {
      showToast('Failed to push changes', 'error');
    }
  };

  const pullChanges = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin' })
      });

      if (response.ok) {
        loadGitInfo();
        showToast('Changes pulled successfully', 'success');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to pull', 'error');
      }
    } catch (error) {
      showToast('Failed to pull changes', 'error');
    }
  };

  const createBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/git/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_name: newBranchName, checkout: true })
      });

      if (response.ok) {
        setNewBranchName('');
        setShowNewBranch(false);
        loadGitInfo();
        showToast(`Created and switched to branch '${newBranchName}'`, 'success');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to create branch', 'error');
      }
    } catch (error) {
      showToast('Failed to create branch', 'error');
    }
  };

  const checkoutBranch = async (branchName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/git/checkout/${branchName}`, {
        method: 'POST'
      });

      if (response.ok) {
        loadGitInfo();
        showToast(`Switched to branch '${branchName}'`, 'success');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to switch branch', 'error');
      }
    } catch (error) {
      showToast('Failed to switch branch', 'error');
    }
  };

  useEffect(() => {
    loadGitInfo();
  }, [projectId]);

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading git information...</div>;
  }

  if (status?.error || branches?.error) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          {status?.error || branches?.error}
        </div>
        <button
          onClick={loadGitInfo}
          className="px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Git Integration</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage git operations for this project
          </p>
        </div>
        <button
          onClick={loadGitInfo}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-gray-900 dark:text-white">Current Branch</h4>
          </div>
          <div className="text-lg font-mono text-gray-900 dark:text-white">
            {status?.branch || 'Unknown'}
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <GitCommit className="w-4 h-4 text-green-600" />
            <h4 className="font-medium text-gray-900 dark:text-white">Working Tree</h4>
          </div>
          <div className={`text-sm ${status?.clean ? 'text-green-600' : 'text-orange-600'}`}>
            {status?.clean ? 'Clean' : `${(status?.modified.length || 0) + (status?.staged.length || 0) + (status?.untracked.length || 0)} changes`}
          </div>
        </div>
      </div>

      {/* Changes */}
      {!status?.clean && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Changes</h4>

          {status?.staged && status.staged.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <h5 className="text-sm font-medium text-green-800 dark:text-green-400 mb-2">Staged ({status.staged.length})</h5>
              <div className="space-y-1">
                {status.staged.map((file, index) => (
                  <div key={index} className="text-xs font-mono text-green-700 dark:text-green-300">{file}</div>
                ))}
              </div>
            </div>
          )}

          {status?.modified && status.modified.length > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
              <h5 className="text-sm font-medium text-orange-800 dark:text-orange-400 mb-2">Modified ({status.modified.length})</h5>
              <div className="space-y-1">
                {status.modified.map((file, index) => (
                  <div key={index} className="text-xs font-mono text-orange-700 dark:text-orange-300">{file}</div>
                ))}
              </div>
            </div>
          )}

          {status?.untracked && status.untracked.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-400 mb-2">Untracked ({status.untracked.length})</h5>
              <div className="space-y-1">
                {status.untracked.map((file, index) => (
                  <div key={index} className="text-xs font-mono text-gray-700 dark:text-gray-300">{file}</div>
                ))}
              </div>
            </div>
          )}

          {/* Commit Section */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h5 className="font-medium text-gray-900 dark:text-white mb-3">Commit Changes</h5>
            <div className="flex gap-2">
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && commitChanges()}
              />
              <button
                onClick={commitChanges}
                disabled={!commitMessage.trim()}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote Operations */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">Remote Operations</h4>
        <div className="flex gap-2">
          <button
            onClick={pullChanges}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Pull
          </button>
          <button
            onClick={pushChanges}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Push
          </button>
        </div>
      </div>

      {/* Branch Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900 dark:text-white">Branches</h4>
          <button
            onClick={() => setShowNewBranch(!showNewBranch)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
        </div>

        {showNewBranch && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="branch-name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && createBranch()}
              />
              <button
                onClick={createBranch}
                disabled={!newBranchName.trim()}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewBranch(false)}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Local Branches */}
        {branches?.local && branches.local.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Local Branches</h5>
            <div className="space-y-1">
              {branches.local.map((branch, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    branch === branches.current
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3 h-3 text-gray-500" />
                    <span className="text-sm font-mono text-gray-900 dark:text-white">{branch}</span>
                    {branch === branches.current && (
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                        current
                      </span>
                    )}
                  </div>
                  {branch !== branches.current && (
                    <button
                      onClick={() => checkoutBranch(branch)}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Switch
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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