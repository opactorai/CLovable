'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  Github,
  FileCode,
  AlertCircle,
  Users,
  Plus,
} from 'lucide-react';
import { githubClient } from '@/lib/github-client';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import { trackGitHubConnected, trackGitHubProjectConnected } from '@/lib/analytics';
import { config } from '@/lib/config';
import { clientLogger } from '@/lib/client-logger';

interface GitHubIntegrationPageProps {
  projectId: string;
  onBack: () => void;
}

interface GitHubConnectionStatus {
  connected: boolean;
  installation?: { 
    id: string; // UUID database ID
    targetLogin: string;
    targetType: string;
  };
  githubUsername?: string;
  hasOAuthToken?: boolean;
}

export default function GitHubIntegrationPage({
  projectId,
  onBack,
}: GitHubIntegrationPageProps) {
  const {
    github: { connectionStatus, projectSyncStatus, installations, isLoading, error: storeError },
    fetchGitHubStatus,
    fetchGitHubInstallations,
    invalidateGitHubStatus,
  } = useIntegrationsStore();

  const projectSync = projectSyncStatus[projectId];

  const [localError, setLocalError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [pendingInstallation, setPendingInstallation] = useState<any | null>(
    null,
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisconnectAccountModal, setShowDisconnectAccountModal] = useState(false);
  const orgCardRef = useRef<HTMLDivElement>(null);

  const error = localError || storeError;

  const filterInstallations = useCallback(
    (items: any[] = []) =>
      items.filter(
        (item) =>
          (item?.targetType === 'Organization' || item?.targetType === 'User') &&
          (item?.permissions?.administration === 'write' ||
            item?.permissions?.contents === 'write'),
      ),
    [],
  );

  // Load initial status
  useEffect(() => {
    loadStatuses();
  }, [projectId]);

  // Auto-scroll to bottom when organizations card appears
  useEffect(() => {
    if (showOrgDropdown && orgCardRef.current) {
      setTimeout(() => {
        const container = orgCardRef.current?.closest('.overflow-y-auto, [style*="overflow-y"]') as HTMLElement;
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        } else {
          // Fallback: scroll the card into view at the bottom
          orgCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    }
  }, [showOrgDropdown]);

  const loadStatuses = async (options: { forceRefresh?: boolean } = {}) => {
    try {
      console.log('📊 [GITHUB STATUS] loadStatuses called with:', options);
      setLocalError(null);

      // Use store to fetch GitHub status (with caching)
      console.log('📡 [GITHUB STATUS] Fetching GitHub status...');
      await fetchGitHubStatus(projectId, options.forceRefresh);
      console.log('✅ [GITHUB STATUS] GitHub status fetched');

      // Always fetch installations after refreshing status
      // (connectionStatus state variable might be stale here)
      console.log('📡 [GITHUB STATUS] Fetching GitHub installations...');
      await fetchGitHubInstallations();
      console.log('✅ [GITHUB STATUS] GitHub installations fetched');
    } catch (error) {
      console.error('❌ [GITHUB STATUS] Failed to load GitHub status:', error);
      setLocalError('Failed to load GitHub integration status');
    }
  };

  const handleConnectProject = async () => {
    clientLogger.debug('🔵 handleConnectProject called');
    try {
      setLocalError(null);
      if (!connectionStatus?.hasOAuthToken) {
        setLocalError('Please add your GitHub account first');
        return;
      }

      setIsConnecting(true);
      await fetchGitHubInstallations();
      clientLogger.debug('📦 Raw installations:', installations);
      const filtered = filterInstallations(installations);
      clientLogger.debug('📋 Filtered installations:', filtered);
      clientLogger.debug('🔍 Filter criteria: targetType === "Organization" && (permissions.administration === "write" || permissions.contents === "write")');

      // Always show dropdown, even if no installations found
      // User can click "Manage Organizations" to install the GitHub App
      setShowOrgDropdown(true);
    } catch (error) {
      clientLogger.error('Failed to connect project:', error);
      setLocalError('Failed to connect project. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const enableSyncForInstallation = async (installationId: string) => {
    try {
      setIsConnecting(true);
      setShowOrgDropdown(false);
      setLocalError(null);

      clientLogger.debug('🔄 Enabling project sync for installation:', installationId);

      const response = await githubClient.enableProjectSync(
        projectId,
        installationId,
        {
          private: true,
        },
      );

      clientLogger.debug('✅ Project sync enabled successfully:', response);

      // Invalidate cache and reload
      invalidateGitHubStatus(projectId);
      await fetchGitHubStatus(projectId, true);

      clientLogger.debug('✅ Status refreshed, new projectSync:', projectSyncStatus[projectId]);

      // Track successful GitHub project connection
      trackGitHubProjectConnected(projectId);
    } catch (error: any) {
      clientLogger.error('❌ Failed to enable project sync:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to connect project to GitHub. Please try again.';
      setLocalError(errorMessage);
      clientLogger.error('Error details:', { error, projectId, installationId });
    } finally {
      setIsConnecting(false);
      setPendingInstallation(null);
      setShowConfirmModal(false);
    }
  };

  const handleConfirmTransfer = async () => {
    clientLogger.debug('🟢 handleConfirmTransfer called', { pendingInstallation });
    if (!pendingInstallation) {
      clientLogger.warn('⚠️ No pending installation found');
      return;
    }
    clientLogger.debug('🚀 Calling enableSyncForInstallation with ID:', pendingInstallation.id);
    await enableSyncForInstallation(pendingInstallation.id);
  };

  const handleCancelConfirm = () => {
    setPendingInstallation(null);
    setShowConfirmModal(false);
  };

  const handleManageOrganizations = async () => {
    try {
      clientLogger.debug('🔧 Opening Manage Organizations...');
      const { installUrl } = await githubClient.getInstallUrl();
      clientLogger.debug('🔗 Install URL:', installUrl);
      const width = 900;
      const height = 700;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const popup = window.open(
        installUrl,
        'github-app-install',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
      clientLogger.debug('🪟 Popup opened:', popup ? 'success' : 'blocked');

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === 'GITHUB_INSTALL_SUCCESS') {
          clientLogger.debug('✅ GitHub App installation successful');
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
          await loadStatuses({ forceRefresh: true });
          await fetchGitHubInstallations();
          clientLogger.debug('🔄 Installations refreshed, showing org dropdown');
          setShowOrgDropdown(true);
        } else if (event.data?.type === 'GITHUB_INSTALL_ERROR') {
          clientLogger.error('❌ GitHub App installation failed:', event.data.message);
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
          setLocalError(event.data.message || 'GitHub installation failed.');
        }
      };

      window.addEventListener('message', handleMessage);

      // Polling fallback; if popup closes without message, refresh once
      const checkInterval = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          await loadStatuses({ forceRefresh: true });
          await fetchGitHubInstallations();
        }
      }, 1500);

      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', handleMessage);
      }, 300000);
    } catch (error) {
      clientLogger.error('Failed to open GitHub App installation page:', error);
      setLocalError('Failed to open GitHub App settings.');
    }
  };

  const handleDisconnectProject = async () => {
    try {
      setLocalError(null);
      await githubClient.disableProjectSync(projectId);

      // Invalidate cache and reload
      invalidateGitHubStatus(projectId);
      await fetchGitHubStatus(projectId, true);
    } catch (error) {
      clientLogger.error('Failed to disconnect project:', error);
      setLocalError('Failed to disconnect project from GitHub.');
    }
  };

  const handleDisconnectAccountClick = () => {
    setShowDisconnectAccountModal(true);
  };

  const handleConfirmDisconnectAccount = async () => {
    try {
      setLocalError(null);
      setShowDisconnectAccountModal(false);
      
      if (!connectionStatus?.installation?.id) {
        setLocalError('No installation found to disconnect');
        return;
      }

      await githubClient.disconnectInstallation(connectionStatus.installation.id);

      // Invalidate cache and reload all statuses
      githubClient.invalidateConnectionStatusCache();
      invalidateGitHubStatus(projectId);
      await loadStatuses({ forceRefresh: true });
      
      clientLogger.debug('✅ GitHub account disconnected successfully');
    } catch (error) {
      clientLogger.error('Failed to disconnect GitHub account:', error);
      setLocalError('Failed to disconnect GitHub account.');
    }
  };

  const handleCancelDisconnectAccount = () => {
    setShowDisconnectAccountModal(false);
  };

  const handleAddGitHubAccount = async () => {
    try {
      // Open GitHub OAuth login in popup window with force_login to allow account switching
      const width = 500;
      const height = 700;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const authToken = localStorage.getItem('token') || '';
      const tokenParam = authToken
        ? `&token=${encodeURIComponent(authToken)}`
        : '';
      const popup = window.open(
        `${config.apiUrl}/api/auth/github?force_login=true&mode=project${tokenParam}`,
        'github-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
      );

      // Listen for OAuth completion message
      const messageHandler = async (event: MessageEvent) => {
        console.log('🔔 [GITHUB OAUTH] Message received:', { 
          origin: event.origin, 
          type: event.data?.type,
          windowOrigin: window.location.origin 
        });

        // Security: Check origin
        if (event.origin !== window.location.origin) {
          console.warn('⚠️ [GITHUB OAUTH] Origin mismatch, ignoring message');
          return;
        }

        if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
          console.log('✅ [GITHUB OAUTH] Success message received, reloading statuses...');
          window.removeEventListener('message', messageHandler);
          if (popup && !popup.closed) {
            popup.close();
          }

          // OAuth successful, reload statuses
          await loadStatuses({ forceRefresh: true });
          console.log('✅ [GITHUB OAUTH] Statuses reloaded successfully');

          // Track successful GitHub account connection
          trackGitHubConnected(true);

          setLocalError(null);
        } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
          console.log('❌ [GITHUB OAUTH] Error message received');
          window.removeEventListener('message', messageHandler);
          if (popup && !popup.closed) {
            popup.close();
          }

          // Track failed GitHub account connection
          trackGitHubConnected(false);

          setLocalError(event.data.error || 'Failed to connect to GitHub');
        }
      };

      window.addEventListener('message', messageHandler);

      // Fallback: Check popup status
      const checkInterval = setInterval(() => {
        if (popup && popup.closed) {
          console.log('🔄 [GITHUB OAUTH] Popup closed, triggering fallback refresh');
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
          // Try to load status in case OAuth succeeded
          loadStatuses({ forceRefresh: true });
        }
      }, 1000);

      // Clear interval after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', messageHandler);
      }, 300000);
    } catch (error) {
      clientLogger.error('Failed to initiate GitHub OAuth login:', error);
      setLocalError('Failed to connect to GitHub.');
    }
  };

  const filteredInstallations = filterInstallations(installations);

  if (isLoading && !connectionStatus) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1a1a1a' }}>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  GitHub
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Sync your project 2-way with GitHub to collaborate at source.
                </p>
              </div>
            </div>
            <a
              href="https://docs.github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <FileCode className="w-4 h-4" />
              Docs
            </a>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Connected Account Section - Step 1 */}
        <div className="border border-gray-200 dark:border-primary rounded-lg p-6 bg-white dark:bg-secondary">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-poppins bg-interactive-secondary text-secondary dark:bg-foreground dark:text-background font-bold">
                1
                </span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 font-poppins">
                  Connect Account
                </h3>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 ml-9 font-poppins max-w-[250px]">
                First, connect your GitHub account to enable organization access.
              </p>
            </div>
            {connectionStatus?.hasOAuthToken ? (
              <div className="flex flex-col gap-3 min-w-[140px]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-poppins text-green-700 dark:text-green-300" style={{ fontWeight: '500' }}>
                    {connectionStatus.githubUsername || 'GitHub User'}
                  </span>
                </div>
                {connectionStatus.installation && (
                  <button
                    onClick={handleDisconnectAccountClick}
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-primary font-poppins hover:bg-red-50 dark:hover:bg-interactive-secondary transition-colors text-red-600 dark:text-red-400"
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleAddGitHubAccount}
                className="px-4 py-2 rounded-lg font-poppins transition-colors bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Add Account
              </button>
            )}
          </div>
        </div>

        {/* Connect Project Section - Step 2 */}
        <div className="border border-gray-200 dark:border-primary rounded-lg p-6 bg-white dark:bg-secondary" style={{ opacity: connectionStatus?.hasOAuthToken ? 1 : 0.6 }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-poppins bg-interactive-secondary text-secondary dark:bg-foreground dark:text-background font-bold flex-shrink-0">
                2
                </span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 font-poppins flex-shrink-0">
                  Connect Project
                </h3>
                {!projectSync?.isSynced && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-poppins bg-gray-100 dark:bg-interactive-secondary text-gray-700 dark:text-gray-300" style={{ fontWeight: '500' }}>
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-gray-400 dark:bg-gray-500"></span>
                    Not connected
                  </span>
                )}
                {projectSync?.isSynced && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </span>
                )}
              </div>
              {projectSync?.isSynced && projectSync.repository && (
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 ml-9 font-poppins">
                  {projectSync.repository.fullName}
                </p>
              )}
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-4 ml-9 font-poppins max-w-[250px]">
                {projectSync?.isSynced && projectSync.repository
                  ? "Auto-created repository for this project with 2-way sync enabled"
                  : connectionStatus?.hasOAuthToken
                    ? "Select an organization to automatically create a private repository for 2-way sync."
                    : "Connect your GitHub account first to enable project sync."}
              </p>
            </div>
            {projectSync?.isSynced ? (
              <div className="flex flex-col gap-3 min-w-[140px]">
                <a
                  href={projectSync.repository?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg font-poppins flex items-center border border-gray-200 dark:border-primary justify-center gap-2 transition-colors bg-gray-900 dark:bg-secondary text-white dark:text-primary hover:bg-gray-800 dark:hover:bg-interactive-secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  View Repo
                </a>
                <button
                  onClick={handleDisconnectProject}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-primary font-poppins transition-colors hover:bg-red-50 dark:hover:bg-interactive-secondary text-red-600 dark:text-red-400"
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Stop Sync
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectProject}
                disabled={isConnecting || !connectionStatus?.hasOAuthToken}
                className="px-4 py-2 rounded-lg transition-colors font-poppins flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (isConnecting || !connectionStatus?.hasOAuthToken) ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? 'Loading...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* GitHub Organizations Card - Shows when selecting organization */}
        {showOrgDropdown && !projectSync?.isSynced && (
          <div ref={orgCardRef} className="border border-gray-200 dark:border-primary rounded-lg bg-white dark:bg-secondary overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-primary">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 font-poppins">
                Select GitHub Organization
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-poppins">
                Choose an organization to create a private repository for 2-way sync.
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto liquid-glass-scrollbar">
              {filteredInstallations.length === 0 && (
                <div className="px-4 py-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-poppins">
                    No GitHub organizations found. Click "Manage Organizations" below to install the GitHub App.
                  </p>
                </div>
              )}
              {filteredInstallations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    clientLogger.debug('🟡 Organization selected:', org);
                    // If organization is already installed, directly enable sync
                    // No need to redirect to GitHub since installation already exists
                    setPendingInstallation(org);
                    setShowOrgDropdown(false);
                    setShowConfirmModal(true);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-elevated dark:hover:bg-elevated flex items-center gap-3 transition-colors border-b border-gray-100 dark:border-primary last:border-b-0"
                >
                  <div className="w-8 h-8 bg-gray-200 dark:bg-elevated rounded flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-gray-600 dark:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-primary font-poppins">
                      {org.targetLogin}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-tertiary font-poppins">
                      {org.targetType}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-primary">
              <button
                onClick={() => {
                  setShowOrgDropdown(false);
                  handleManageOrganizations();
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-interactive-secondary rounded flex items-center justify-center gap-2 transition-colors font-poppins"
              >
                <Plus className="w-4 h-4" />
                Manage Organizations
              </button>
            </div>
          </div>
        )}
      </div>
      {showConfirmModal && pendingInstallation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-secondary rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-primary">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Transfer to Set Up 2-Way Sync
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                You&apos;re moving this project to your GitHub organization
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {' '}
                  {pendingInstallation.targetLogin}
                </span>
                . This will create or reuse a repository inside that
                organization so changes stay in sync with Clink. Make sure you
                have the right permissions before continuing.
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This isn&apos;t reversible without disconnecting the
                integration. Do you want to continue?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancelConfirm}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-primary text-primary dark:text-primary hover:bg-gray-50 dark:hover:bg-elevated transition-colors"
                disabled={isConnecting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={isConnecting}
                className="px-4 py-2 rounded-lg font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/60 dark:border-primary border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Transfer anyway'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisconnectAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-secondary rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-primary">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-primary mb-6">
                Disconnect GitHub Account?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                This will disconnect your GitHub account
                {connectionStatus?.installation?.targetLogin && (
                  <span className="font-semibold text-gray-900 dark:text-primary">
                    {' '}
                    {connectionStatus.installation.targetLogin}
                  </span>
                )}
                {' '}from Clink and disable auto-sync for all projects connected to this account.
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-6">
                This will affect all projects using this GitHub connection.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancelDisconnectAccount}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-primary text-primary dark:text-primary hover:bg-gray-50 dark:hover:bg-elevated transition-colors font-poppins"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnectAccount}
                className="px-4 py-2 rounded-lg font-poppins bg-red-600 dark:bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-700 transition-colors"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Disconnect Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
