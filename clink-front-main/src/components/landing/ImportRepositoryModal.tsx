'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitBranch, Loader2, AlertCircle, Github, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { githubClient } from '@/lib/github-client';

export interface RepositoryData {
  name: string;
  fullName: string;
  url: string;
  branch: string;
  description?: string;
  githubInstallationId?: number;
}

interface ImportRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (repositoryData: RepositoryData) => void;
}

export default function ImportRepositoryModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportRepositoryModalProps) {
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub connection state
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  // Repository selection state
  const [showRepositoryPicker, setShowRepositoryPicker] = useState(false);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);

  // Installations (organizations) state
  const [installations, setInstallations] = useState<any[]>([]);
  const [isLoadingInstallations, setIsLoadingInstallations] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<any>(null);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Check GitHub connection status when modal opens
  useEffect(() => {
    if (isOpen) {
      // Invalidate cache to ensure fresh data
      githubClient.invalidateConnectionStatusCache('import');
      checkGithubConnection();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setGithubRepoUrl('');
      setBranch('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const checkGithubConnection = async () => {
    setIsCheckingGithub(true);
    try {
      console.log('[ImportRepositoryModal] Checking GitHub connection...');
      const status = await githubClient.getConnectionStatus({
        forceRefresh: true,
        mode: 'import',
      });
      console.log('[ImportRepositoryModal] Connection status:', status);
      setGithubConnected(status.connected);
      setGithubUsername(status.githubUsername || status.installation?.targetLogin || null);

      // Auto-load installations and repositories if connected
      if (status.connected) {
        console.log('[ImportRepositoryModal] GitHub connected, loading installations...');
        await loadInstallations(true); // Pass true to indicate initial load
      } else {
        console.log('[ImportRepositoryModal] GitHub not connected');
      }
    } catch (err: any) {
      console.error('[ImportRepositoryModal] Failed to check GitHub connection:', err);
      console.error('[ImportRepositoryModal] Error details:', err.response || err.message);
      setGithubConnected(false);
      setGithubUsername(null);
      
      // Set user-friendly error message
      const errorMessage = err.message || 'Failed to check GitHub connection';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError('Unable to connect to server. Please check your internet connection and try again.');
      } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        setError('Your session has expired. Please refresh the page and log in again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsCheckingGithub(false);
    }
  };

  const loadInstallations = async (isInitialLoad = false) => {
    if (!isInitialLoad) {
      setIsLoadingInstallations(true);
    }
    try {
      console.log('[ImportRepositoryModal] Loading installations...');
      const data = await githubClient.getInstallations({ mode: 'import' });
      console.log('[ImportRepositoryModal] Loaded installations:', data.installations);
      setInstallations(data.installations);

      // Auto-select first installation and load its repositories
      if (data.installations.length > 0 && !selectedInstallation) {
        setSelectedInstallation(data.installations[0]);
        await loadRepositoriesForInstallation(data.installations[0], isInitialLoad);
      }
    } catch (err: any) {
      console.error('[ImportRepositoryModal] Failed to load installations:', err);
      setError('Failed to load organizations. Please try again.');
      setInstallations([]);
    } finally {
      if (!isInitialLoad) {
        setIsLoadingInstallations(false);
      }
    }
  };

  const loadRepositoriesForInstallation = async (installation: any, isInitialLoad = false) => {
    if (!isInitialLoad) {
      setIsLoadingRepos(true);
    }
    setError(null);
    try {
      console.log('[ImportRepositoryModal] Loading repositories for installation:', installation.targetLogin, 'installationId:', installation.installationId);
      const data = await githubClient.getRepositories(1, 100, installation.installationId, {
        mode: 'import',
      });
      console.log('[ImportRepositoryModal] Loaded repositories:', data.repositories.length);
      setRepositories(data.repositories);
      // Auto-show repository picker when repos are loaded
      if (data.repositories.length > 0) {
        setShowRepositoryPicker(true);
      }
    } catch (err: any) {
      console.error('[ImportRepositoryModal] Failed to load repositories:', err);
      console.error('[ImportRepositoryModal] Error details:', err.response || err.message);
      setError('Failed to load repositories. Please try connecting again.');
      setRepositories([]);
    } finally {
      if (!isInitialLoad) {
        setIsLoadingRepos(false);
      }
    }
  };

  const handleSelectInstallation = (installation: any) => {
    setSelectedInstallation(installation);
    setShowRepositoryPicker(false);
    setSelectedRepo(null);
    loadRepositoriesForInstallation(installation);
  };

  const handleSelectRepository = (repo: any) => {
    setSelectedRepo(repo);
    setGithubRepoUrl(repo.html_url);
    // Use repo's default branch, fallback to 'main' if not available
    setBranch(repo.default_branch || 'main');
    console.log('[ImportRepositoryModal] Selected repo:', repo.full_name, 'default_branch:', repo.default_branch);
    // Don't close the picker, just mark as selected
  };


  const handleConnectGithub = async () => {
    setError(null);
    setIsCheckingGithub(true);

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    console.log('[ImportRepositoryModal] Checking login status, token exists:', !!token);
    console.log('[ImportRepositoryModal] User data:', user);

    if (!token) {
      console.error('[ImportRepositoryModal] No auth token found - user not logged in');
      setError('Please log in to connect your GitHub account');
      setIsCheckingGithub(false);
      return;
    }

    try {
      // First check if user has GitHub OAuth linked
      console.log('[ImportRepositoryModal] Checking GitHub OAuth status...');
      const status = await githubClient.getConnectionStatus({
        forceRefresh: true,
        mode: 'import',
      });

      // If user doesn't have OAuth token, redirect to GitHub OAuth first
      if (!status.hasOAuthToken) {
        console.log('[ImportRepositoryModal] No GitHub OAuth token found, opening GitHub OAuth in popup...');
        
        // Open GitHub OAuth in popup
        const authUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/github?mode=project&token=${token}`;
        
        const width = 600;
        const height = 700;
        const left = window.innerWidth / 2 - width / 2;
        const top = window.innerHeight / 2 - height / 2;

        const oauthPopup = window.open(
          authUrl,
          'github-oauth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for OAuth success message
        const handleOAuthMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
            console.log('[ImportRepositoryModal] ✅ GitHub OAuth successful! Received message from popup');
            console.log('[ImportRepositoryModal] OAuth data:', event.data);
            window.removeEventListener('message', handleOAuthMessage);
            
            if (oauthPopup && !oauthPopup.closed) {
              console.log('[ImportRepositoryModal] Closing OAuth popup');
              oauthPopup.close();
            }

            // Small delay to let backend process the OAuth
            console.log('[ImportRepositoryModal] Waiting 1s for backend to process OAuth...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Now check connection status again - should have OAuth token now
            console.log('[ImportRepositoryModal] Refreshing connection status after OAuth');
            await checkGithubConnection();
            console.log('[ImportRepositoryModal] Connection status refreshed, should show App install button now');
          }
        };

        window.addEventListener('message', handleOAuthMessage);

        // Cleanup if popup closes without message
        const checkInterval = setInterval(() => {
          if (oauthPopup && oauthPopup.closed) {
            clearInterval(checkInterval);
            window.removeEventListener('message', handleOAuthMessage);
            console.log('[ImportRepositoryModal] OAuth popup closed without message, checking connection...');
            checkGithubConnection();
            setIsCheckingGithub(false);
          }
        }, 1000);

        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleOAuthMessage);
          setIsCheckingGithub(false);
        }, 300000);

        return;
      }

      console.log('[ImportRepositoryModal] User has GitHub OAuth, proceeding to App installation...');
      setIsCheckingGithub(false);
      console.log('[ImportRepositoryModal] Requesting GitHub install URL...');
      const response = await githubClient.getInstallUrl('import');
      console.log('[ImportRepositoryModal] Install URL response:', response);

      const { installUrl, state, userId } = response;
      console.log('[ImportRepositoryModal] State parameter:', state);
      console.log('[ImportRepositoryModal] UserId from backend:', userId);
      console.log('[ImportRepositoryModal] Received install URL:', installUrl);

      // Open GitHub App installation in popup window
      const width = 800;
      const height = 800;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const popup = window.open(
        installUrl,
        'github-app-install',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Listen for success message from callback page
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === 'GITHUB_INSTALL_SUCCESS') {
          console.log('[ImportRepositoryModal] GitHub installation successful, refreshing data...');
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }

          // Refresh connection status and load installations
          const status = await githubClient.getConnectionStatus({
            forceRefresh: true,
            mode: 'import',
          });
          setGithubConnected(status.connected);
          setGithubUsername(status.githubUsername || status.installation?.targetLogin || null);

          if (status.connected) {
            await loadInstallations();
          }
        } else if (event.data?.type === 'GITHUB_INSTALL_ERROR') {
          console.error('[ImportRepositoryModal] GitHub installation failed:', event.data.message);
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
          setError(event.data.message || 'GitHub installation failed.');
        }
      };

      window.addEventListener('message', handleMessage);

      // Polling fallback: if popup closes without message, refresh once
      const checkInterval = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          console.log('[ImportRepositoryModal] Popup closed, syncing installations from GitHub...');

          // Add a small delay to allow GitHub to process the installation
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Sync installations from GitHub API
          try {
            console.log('[ImportRepositoryModal] Calling sync API...');
            const syncResult = await githubClient.syncInstallations({ mode: 'import' });
            console.log('[ImportRepositoryModal] Sync result:', syncResult);

            if (syncResult.syncedCount > 0) {
              console.log('[ImportRepositoryModal] Successfully synced', syncResult.syncedCount, 'installations');

              // Refresh connection status
              const status = await githubClient.getConnectionStatus({
                forceRefresh: true,
                mode: 'import',
              });
              setGithubConnected(status.connected);
              setGithubUsername(status.githubUsername || status.installation?.targetLogin || null);

              if (status.connected) {
                await loadInstallations();
              }
            } else {
              console.log('[ImportRepositoryModal] No installations synced, user may not have completed setup');
            }
          } catch (err) {
            console.error('[ImportRepositoryModal] Failed to sync installations after popup close:', err);
          }
        }
      }, 1000);

      // Cleanup after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', handleMessage);
      }, 120000);
    } catch (err: any) {
      console.error('[ImportRepositoryModal] Failed to get install URL:', err);
      console.error('[ImportRepositoryModal] Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });

      let errorMessage = 'Failed to connect to GitHub';

      // Check if it's a 401 error (authentication failure)
      if (err.message?.includes('Authentication failed') || err.message?.includes('401')) {
        errorMessage = 'Session expired. Please refresh the page and log in again.';
        // Optionally redirect to login
        // setTimeout(() => {
        //   window.location.href = '/login';
        // }, 2000);
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  const validateGithubUrl = (url: string): boolean => {
    const githubRegex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/;
    return githubRegex.test(url.trim());
  };

  const handleImport = async () => {
    setError(null);

    if (!githubRepoUrl.trim()) {
      setError('Please select a repository to import');
      return;
    }

    if (!validateGithubUrl(githubRepoUrl)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      return;
    }

    if (!selectedRepo) {
      setError('Please select a repository from the list');
      return;
    }

    setIsImporting(true);

    try {
      // Prepare repository data to return
      const repositoryData: RepositoryData = {
        name: selectedRepo.name,
        fullName: selectedRepo.full_name,
        url: githubRepoUrl.trim(),
        branch: branch.trim() || 'main',
        description: selectedRepo.description || undefined,
        githubInstallationId: selectedInstallation?.installationId || undefined,
      };

      console.log('[ImportRepositoryModal] Repository selected:', repositoryData);

      // Immediately call onSuccess
      onSuccess?.(repositoryData);
      onClose();
    } catch (err: any) {
      console.error('Selection failed:', err);
      setError(err.message || 'Failed to select repository. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isImporting) {
      e.preventDefault();
      handleImport();
    }
  };

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9998]"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-primary rounded-2xl shadow-2xl border border-primary max-w-lg w-full pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-primary">Import GitHub Repository</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-interactive flex items-center justify-center transition-colors"
                  disabled={isImporting}
                >
                  <X className="w-5 h-5 text-secondary" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 space-y-4">
                {isCheckingGithub ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                  </div>
                ) : !githubConnected ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-secondary">GitHub Account</label>
                    <button
                      onClick={handleConnectGithub}
                      className="w-full p-3 border border-primary rounded-lg text-left flex items-center justify-between hover:bg-interactive transition-colors"
                    >
                      <span className="text-sm text-secondary">Connect GitHub</span>
                      <svg className="w-4 h-4 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Organization Selector */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-secondary">Organization</label>
                        <button
                          onClick={handleConnectGithub}
                          className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add
                        </button>
                      </div>

                      {isLoadingInstallations ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                        </div>
                      ) : installations.length > 0 ? (
                        <div className="relative">
                          <button
                            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                            className="w-full p-3 border border-primary rounded-lg text-left flex items-center justify-between hover:bg-interactive transition-colors"
                          >
                            <span className="text-sm text-primary">
                              {selectedInstallation ? `${selectedInstallation.targetLogin}` : 'Select organization'}
                            </span>
                            <svg className={`w-4 h-4 text-secondary transition-transform ${showOrgDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showOrgDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-primary border border-primary rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                              {installations.map((installation) => (
                                <button
                                  key={installation.id}
                                  onClick={() => {
                                    handleSelectInstallation(installation);
                                    setShowOrgDropdown(false);
                                  }}
                                  className="w-full p-3 text-left hover:bg-interactive transition-colors flex items-center justify-between border-b border-primary last:border-b-0"
                                >
                                  <span className="text-sm text-primary">{installation.targetLogin}</span>
                                  {selectedInstallation?.id === installation.id && (
                                    <Check className="w-4 h-4 text-accent" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-tertiary p-3">No organizations found</p>
                      )}
                    </div>
                  </>
                )}


                {/* Repository List - Always visible when connected */}
                {githubConnected && (
                  <>
                    {isLoadingRepos ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-secondary">Repository</label>
                        <div className={`overflow-y-auto space-y-2 repo-list-scrollbar ${repositories.length > 0 ? 'h-80' : ''}`} style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
                        }}>
                          {repositories.length > 0 ? (
                            repositories.map((repo) => {
                              const isSelected = selectedRepo?.id === repo.id;
                              return (
                                <button
                                  key={repo.id}
                                  onClick={() => handleSelectRepository(repo)}
                                  className={`w-full p-3 text-left border rounded-lg hover:bg-interactive transition-all group ${
                                    isSelected
                                      ? 'border-green-500 bg-green-500/10'
                                      : 'border-primary'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${
                                        isSelected
                                          ? 'text-green-500'
                                          : 'text-primary group-hover:text-accent'
                                      }`}>
                                        {repo.full_name}
                                      </p>
                                      {repo.description && (
                                        <p className="text-xs text-tertiary mt-1 line-clamp-1">
                                          {repo.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-2">
                                        {repo.language && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-interactive text-secondary">
                                            {repo.language}
                                          </span>
                                        )}
                                        {repo.private && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500">
                                            Private
                                          </span>
                                        )}
                                        <span className="text-xs text-tertiary">
                                          {repo.default_branch}
                                        </span>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="flex items-center justify-center py-8">
                              <p className="text-sm text-tertiary">No repositories found</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}


                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-500">{error}</p>
                  </motion.div>
                )}


              </div>

              {/* Footer - Only show when GitHub is connected */}
              {!isCheckingGithub && githubConnected && (
                <div className="flex items-center justify-end gap-3 px-6 pb-6">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary
                    transition-colors"
                    disabled={isImporting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || !githubRepoUrl.trim() || !selectedRepo}
                    className="px-5 py-2 text-sm font-medium text-white bg-accent rounded-lg
                    hover:bg-accent-hover active:scale-95 transition-all shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                    flex items-center gap-2"
                  >
                    {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isImporting ? 'Selecting...' : 'Select Repository'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
