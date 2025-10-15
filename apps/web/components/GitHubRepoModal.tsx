"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface GitHubRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onSuccess: () => void;
}

export default function GitHubRepoModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName,
  onSuccess 
}: GitHubRepoModalProps) {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const sanitizeRepoName = (name: string): string => {
    if (!name) return '';
    
    return name
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove invalid characters
      .replace(/[^a-z0-9.-]/g, '')
      // Remove consecutive periods and hyphens
      .replace(/[-]{2,}/g, '-')
      .replace(/[.]{2,}/g, '.')
      // Remove leading/trailing periods and hyphens
      .replace(/^[.-]+|[.-]+$/g, '')
      // Limit to 100 characters
      .substring(0, 100);
  };

  const validateRepoName = (name: string): string => {
    if (!name.trim()) {
      return 'Repository name is required';
    }

    // GitHub repository name constraints
    if (name.length > 100) {
      return 'Repository name must be 100 characters or less';
    }

    if (name.startsWith('.') || name.startsWith('-') || name.endsWith('.') || name.endsWith('-')) {
      return 'Repository name cannot start or end with a period or hyphen';
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return 'Repository name can only contain alphanumeric characters, periods, hyphens, and underscores';
    }

    if (name.includes('..')) {
      return 'Repository name cannot contain consecutive periods';
    }

    // Reserved names
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
    if (reservedNames.includes(name.toLowerCase())) {
      return 'Repository name cannot be a reserved name';
    }

    return '';
  };

  const checkRepoAvailability = async (name: string): Promise<string> => {
    if (!name.trim()) return '';
    
    try {
      setIsCheckingAvailability(true);
      const response = await fetch(`${API_BASE}/api/github/check-repo/${encodeURIComponent(name)}`, {
        method: 'GET'
      });
      
      if (response.status === 409) {
        return `Repository name "${name}" already exists`;
      } else if (response.status === 404) {
        // API endpoint not implemented yet, skip availability check
        console.warn('GitHub check-repo API not implemented yet');
        return '';
      } else if (response.status === 401) {
        return 'GitHub token not configured. Please add your token in Global Settings.';
      } else if (!response.ok) {
        // If we can't check availability, don't block the user
        console.warn('Could not check repository availability:', response.status);
        return '';
      }
      
      return '';
    } catch (error) {
      console.error('Error checking repository availability:', error); // changed warn to error
      return '';
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Initialize and set sanitized repo name when modal opens
  useEffect(() => {
    if (isOpen && !repoName) {
      const sanitized = sanitizeRepoName(projectName || projectId || '');
      setRepoName(sanitized);
    }
  }, [isOpen, projectName, projectId]);

  // Validate repo name when it changes
  useEffect(() => {
    if (repoName) {
      const basicError = validateRepoName(repoName);
      if (basicError) {
        setNameError(basicError);
      } else {
        // Check availability if basic validation passes
        // Temporarily disable API check - allow modal to appear
        setNameError(''); // Set no error if basic validation passes
        /*
        const timeoutId = setTimeout(async () => {
          const availabilityError = await checkRepoAvailability(repoName);
          setNameError(availabilityError);
        }, 500); // Debounce API calls
        */
        
        // return () => clearTimeout(timeoutId);
      }
    } else {
      setNameError('Repository name is required');
    }
  }, [repoName]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setRepoName('');
      setNameError('');
      setDescription('');
      setIsPrivate(false);
      setIsCheckingAvailability(false);
    }
  }, [isOpen]);

  const handleRepoNameChange = (value: string) => {
    setRepoName(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateRepoName(repoName);
    if (error) {
      setNameError(error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/github/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: repoName.trim(),
          description: description.trim(),
          private: isPrivate
        })
      });

      if (response.ok) {
        const result = await response.json();
        onSuccess();
        onClose();
        // Show success message with repository URL
        alert(`Repository created successfully!\n${result.repo_url}`);
      } else {
        let errorMessage = 'Unknown error occurred';
        
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          errorMessage = await response.text() || `HTTP ${response.status}: ${response.statusText}`;
        }

        if (response.status === 404) {
          errorMessage = 'API endpoint not found. Please ensure the backend service is running and the GitHub integration is properly configured.';
        } else if (response.status === 401) {
          errorMessage = 'GitHub authentication failed. Please check your GitHub token in Global Settings.';
        } else if (response.status === 403) {
          errorMessage = 'GitHub access denied. Please ensure your token has the required permissions to create repositories.';
        }

        alert(`Failed to create repository:\n${errorMessage}`);
      }
    } catch (error) {
      console.error('GitHub repository creation error:', error);
      alert('Failed to create repository. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
        <div className="absolute inset-0" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          </motion.div>
        </div>
        
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            data-testid="github-repo-modal"
          >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 98 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create a new repository</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">A repository contains all project files, including revision history.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                disabled={isLoading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Repository Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Repository name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => handleRepoNameChange(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${
                      nameError 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    placeholder="my-awesome-project"
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                  {isCheckingAvailability && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-white"></div>
                    </div>
                  )}
                </div>
                {nameError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    {nameError}
                  </p>
                )}
                {!nameError && !isCheckingAvailability && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Great repository names are short and memorable. Need inspiration? How about <button type="button" className="text-gray-900 dark:text-white hover:underline" onClick={() => {
                      const suggestion = sanitizeRepoName(`${projectName || 'project'}-${Math.random().toString(36).substring(7)}`);
                      handleRepoNameChange(suggestion);
                    }}>
                      {sanitizeRepoName(`${projectName || 'project'}-${Math.random().toString(36).substring(7)}`)}
                    </button>?
                  </p>
                )}
                {isCheckingAvailability && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Checking availability...
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="A short description of your repository"
                  disabled={isLoading}
                />
              </div>

              {/* Repository Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Repository visibility
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!isPrivate}
                      onChange={() => setIsPrivate(false)}
                      className="mt-1 text-gray-900 dark:text-white"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" stroke="currentColor" strokeWidth="2"/>
                          <path d="M7 7V5a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">Public</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Anyone on the internet can see this repository. You choose who can commit.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="visibility"
                      checked={isPrivate}
                      onChange={() => setIsPrivate(true)}
                      className="mt-1 text-gray-900 dark:text-white"
                      disabled={isLoading}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a7 7 0 0 0-14 0v2" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">Private</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        You choose who can see and commit to this repository.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md font-medium transition-colors flex items-center gap-2"
                disabled={isLoading || isCheckingAvailability || !repoName.trim() || !!nameError}
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {isLoading ? 'Creating repository...' : 'Create repository'}
              </button>
            </div>
          </form>
          </motion.div>
        </div>
        </div>
      )}
    </AnimatePresence>
  );
}