/**
 * Vercel Project Connection Modal
 * Create and connect a Vercel project to the existing GitHub repository
 */
import React, { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface VercelProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onSuccess: () => void;
}

export default function VercelProjectModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName,
  onSuccess 
}: VercelProjectModalProps) {
  const [vercelProjectName, setVercelProjectName] = useState('');
  const [framework, setFramework] = useState('nextjs');
  const [teamId, setTeamId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Initialize with project name when modal opens
  useEffect(() => {
    if (isOpen && projectName) {
      const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      setVercelProjectName(sanitizedName);
    }
  }, [isOpen, projectName]);

  // Check project name availability
  const checkAvailability = async (name: string) => {
    if (!name.trim()) {
      setIsAvailable(null);
      return;
    }

    setCheckingAvailability(true);
    try {
      const response = await fetch(`${API_BASE}/api/vercel/check-project/${encodeURIComponent(name)}`);
      
      if (response.ok) {
        setIsAvailable(true);
        setError('');
      } else {
        try {
          const errorData = await response.json();
          setIsAvailable(false);
          if (response.status === 401) {
            setError('Invalid Vercel token. Please check your token in Settings.');
          } else if (response.status === 409) {
            setError('Project name already exists');
          } else {
            setError(errorData.detail || 'Project name not available');
          }
        } catch {
          setIsAvailable(false);
          setError('Project name not available');
        }
      }
    } catch (err) {
      console.error('Error checking Vercel project availability:', err);
      setError('Failed to check availability. Please check your Vercel token.');
      setIsAvailable(null);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Debounced availability check - temporarily disabled
  useEffect(() => {
    // Temporarily disable availability check to avoid API issues
    if (vercelProjectName.trim()) {
      setIsAvailable(true);
      setError('');
    } else {
      setIsAvailable(null);
    }
  }, [vercelProjectName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vercelProjectName.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/vercel/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: vercelProjectName.trim(),
          framework: framework,
          team_id: teamId.trim() || undefined
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess();
        onClose();
        alert(`Success! ${result.message}`);
      } else {
        try {
          const errorData = await response.json();
          if (response.status === 400) {
            setError(errorData.detail || 'GitHub repository must be connected first');
          } else if (response.status === 401) {
            setError('Invalid Vercel token. Please check your token in Settings.');
          } else {
            setError(errorData.detail || 'Failed to connect Vercel project');
          }
        } catch {
          setError('Failed to connect Vercel project');
        }
      }
    } catch (err) {
      console.error('Error connecting Vercel:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setVercelProjectName('');
    setFramework('nextjs');
    setTeamId('');
    setError('');
    setIsAvailable(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Connect to Vercel
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This will create a new Vercel project and link it to your existing GitHub repository.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={vercelProjectName}
              onChange={(e) => setVercelProjectName(e.target.value)}
              placeholder="my-awesome-project"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              disabled={isLoading}
            />
            {isAvailable === true && vercelProjectName.trim() && (
              <p className="text-sm text-green-600 mt-1">✓ Ready to create project</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Framework
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 [&>option]:bg-white [&>option]:dark:bg-gray-700 [&>option]:text-gray-900 [&>option]:dark:text-gray-100"
              disabled={isLoading}
            >
              <option value="nextjs" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Next.js</option>
              <option value="react" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">React</option>
              <option value="vue" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Vue.js</option>
              <option value="nuxtjs" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Nuxt.js</option>
              <option value="svelte" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Svelte</option>
              <option value="angular" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Angular</option>
              <option value="static" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Static HTML</option>
              <option value="other" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team ID (Optional)
            </label>
            <input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="team_xxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for personal projects
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isLoading || !vercelProjectName.trim()}
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}