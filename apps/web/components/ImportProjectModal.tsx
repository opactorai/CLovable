"use client";

import { useState, useEffect } from 'react';
import { FolderOpen, GitBranch, Code, Clock } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface ImportableProject {
  path: string;
  name: string;
  type: string;
  description?: string;
  tech_stack: string[];
  has_git: boolean;
  sessions_count: number;
  created_at: string;
}

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportProjectModal({ isOpen, onClose, onImported }: ImportProjectModalProps) {
  const [claudeProjects, setClaudeProjects] = useState<ImportableProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [scanResults, setScanResults] = useState<ImportableProject[]>([]);

  const loadClaudeProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/projects/scan-claude-projects`);
      if (response.ok) {
        const data = await response.json();
        setClaudeProjects(data);
      }
    } catch (error) {
      console.error('Failed to scan Claude projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const scanCustomDirectory = async () => {
    if (!customPath.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/projects/scan-directory/${encodeURIComponent(customPath)}`);
      if (response.ok) {
        const data = await response.json();
        setScanResults(data);
      }
    } catch (error) {
      console.error('Failed to scan directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const importProject = async (project: ImportableProject) => {
    try {
      setImporting(project.path);

      const response = await fetch(`${API_BASE}/api/projects/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: project.path,
          name: project.name,
          description: project.description
        })
      });

      if (response.ok) {
        onImported();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to import project: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to import project:', error);
      alert('Failed to import project');
    } finally {
      setImporting(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClaudeProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const ProjectCard = ({ project }: { project: ImportableProject }) => (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-gray-900 dark:text-white">{project.name}</h4>
            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {project.type}
            </span>
            {project.has_git && <GitBranch className="w-4 h-4 text-green-600" />}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {project.description || 'No description'}
          </p>

          <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {project.path}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
            {project.tech_stack.length > 0 && (
              <div className="flex items-center gap-1">
                <Code className="w-3 h-3" />
                <span>{project.tech_stack.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{project.sessions_count} sessions</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => importProject(project)}
          disabled={importing === project.path}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {importing === project.path ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import Existing Project</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Claude Projects Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Claude Projects</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Projects found in ~/.claude/projects
            </p>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Scanning for projects...</div>
            ) : claudeProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No existing Claude projects found</div>
            ) : (
              <div className="space-y-3">
                {claudeProjects.map((project, index) => (
                  <ProjectCard key={index} project={project} />
                ))}
              </div>
            )}
          </div>

          {/* Custom Directory Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Scan Custom Directory</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/path/to/your/projects"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                onClick={scanCustomDirectory}
                disabled={!customPath.trim() || loading}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Scan
              </button>
            </div>

            {scanResults.length > 0 && (
              <div className="space-y-3">
                {scanResults.map((project, index) => (
                  <ProjectCard key={index} project={project} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}