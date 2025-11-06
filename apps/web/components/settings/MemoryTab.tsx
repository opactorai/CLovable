"use client";

import { useState, useEffect } from 'react';
import { FileText, Save, RefreshCw, Eye, Edit3 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface MemoryTabProps {
  projectId: string;
  preferredCli?: string;
}

export function MemoryTab({ projectId, preferredCli = 'claude' }: MemoryTabProps) {
  const [claudeContent, setClaudeContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getMemoryFileName = () => {
    return preferredCli === 'claude' ? 'CLAUDE.md' : 'AGENT.md';
  };

  const loadClaudeFile = async () => {
    try {
      setLoading(true);
      const fileName = getMemoryFileName();

      // Try local project file first
      let response = await fetch(`${API_BASE}/api/projects/${projectId}/memory/${fileName}`);

      if (!response.ok && response.status === 404) {
        // Fallback to global CLI-specific file
        const cliDir = preferredCli === 'claude' ? 'claude' : preferredCli;
        response = await fetch(`${API_BASE}/api/${cliDir}/agents/${fileName}`);
      }

      if (response.ok) {
        const data = await response.json();
        setClaudeContent(data.content || getDefaultClaudeContent());
      } else if (response.status === 404) {
        // Neither exists, use default content
        setClaudeContent(getDefaultClaudeContent());
      }
    } catch (error) {
      console.error(`Failed to load ${getMemoryFileName()}:`, error);
      setClaudeContent(getDefaultClaudeContent());
    } finally {
      setLoading(false);
    }
  };

  const saveClaudeFile = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/claude-md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: claudeContent })
      });

      if (response.ok) {
        showToast('Project CLAUDE.md saved successfully', 'success');
        setIsEditing(false);
      } else {
        showToast('Failed to save project CLAUDE.md', 'error');
      }
    } catch (error) {
      showToast('Failed to save project CLAUDE.md', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getDefaultClaudeContent = () => `# Project Memory & Instructions

## Project Overview
This file contains project-specific instructions and memory for Claude Code.

## Project Context
- **Project**: ${projectId}
- **Purpose**: [Describe the project's main purpose]
- **Tech Stack**: [List technologies used]

## Development Guidelines
- [Add project-specific coding standards]
- [Include architectural decisions]
- [Document any special requirements]

## Memory & Learnings
- [Important decisions made during development]
- [Patterns and approaches that work well]
- [Things to avoid or be careful about]

## Current Status
- [What's been completed]
- [What's currently in progress]
- [Next steps and priorities]

## Notes
- [Any additional context Claude should remember]
`;

  useEffect(() => {
    loadClaudeFile();
  }, [projectId]);

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading project memory...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Project Memory</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CLAUDE.md file for project-specific instructions and memory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadClaudeFile}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              isEditing
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
            }`}
          >
            {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>
      </div>

      {/* File Info */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <FileText className="w-4 h-4" />
        <span>./{getMemoryFileName()} (project-specific)</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
          {claudeContent.length} characters
        </span>
      </div>

      {/* Content */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={claudeContent}
              onChange={(e) => setClaudeContent(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm border-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project instructions and memory for Claude..."
            />
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveClaudeFile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white dark:bg-gray-800">
            <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white font-mono leading-relaxed">
              {claudeContent || 'No content yet. Click Edit to add project memory and instructions.'}
            </pre>
          </div>
        )}
      </div>

      {/* Helper Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>About CLAUDE.md:</strong> This file helps Claude remember project context, coding patterns,
          architectural decisions, and important notes across conversations. It's automatically included in Claude's context.
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