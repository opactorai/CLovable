'use client';

import { useState, useEffect } from 'react';
import {
  Check,
  Database,
  FileCode,
  AlertCircle,
  Plus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { supabaseClient } from '@/lib/supabase-client';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import { trackSupabaseConnected, trackSupabaseProjectConnected } from '@/lib/analytics';

interface SupabaseIntegrationPageProps {
  projectId: string;
  onBack: () => void;
}

interface SupabaseOrganization {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  role: 'owner' | 'admin' | 'member';
  projectCount: number;
  status: string;
}

export default function SupabaseIntegrationPage({
  projectId,
  onBack,
}: SupabaseIntegrationPageProps) {
  const {
    supabase: { connectionStatus, projectStatus, organizations, isLoading, error: storeError },
    fetchSupabaseStatus,
    fetchSupabaseOrganizations,
    invalidateSupabaseStatus,
  } = useIntegrationsStore();

  const currentProjectStatus = projectStatus[projectId];

  const [localError, setLocalError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const error = localError || storeError;

  useEffect(() => {
    loadStatuses();
  }, [projectId]);

  const loadStatuses = async (options: { forceRefresh?: boolean } = {}) => {
    try {
      setLocalError(null);

      // Use store to fetch Supabase status (with caching)
      await fetchSupabaseStatus(projectId, options.forceRefresh);

      // Fetch organizations if account is connected
      // Get fresh state from store after fetchSupabaseStatus completes
      const freshState = useIntegrationsStore.getState();
      if (freshState.supabase.connectionStatus?.account) {
        await fetchSupabaseOrganizations();
      }
    } catch (error) {
      console.error('Failed to load Supabase status:', error);
      setLocalError('Failed to load Supabase integration status');
    }
  };

  const handleConnectAccount = async () => {
    try {
      setLocalError(null);
      setIsConnecting(true);

      const { oauthUrl } = await supabaseClient.getOAuthUrl();

      const width = 600;
      const height = 700;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      const popup = window.open(
        oauthUrl,
        'supabase-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === 'SUPABASE_CONNECT_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
          await loadStatuses({ forceRefresh: true });

          // Track successful Supabase account connection
          trackSupabaseConnected(true);
        } else if (event.data?.type === 'SUPABASE_CONNECT_ERROR') {
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }

          // Track failed Supabase account connection
          trackSupabaseConnected(false);

          setLocalError(event.data.message || 'Supabase connection failed.');
        }
      };

      window.addEventListener('message', handleMessage);

      const checkInterval = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          await loadStatuses({ forceRefresh: true });
        }
      }, 1500);

      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', handleMessage);
      }, 300000);
    } catch (error) {
      console.error('Failed to connect Supabase account:', error);
      setLocalError('Failed to connect Supabase account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncOrganizations = async () => {
    try {
      setLocalError(null);
      await fetchSupabaseOrganizations();
    } catch (error) {
      console.error('Failed to sync organizations:', error);
      setLocalError('Failed to sync organizations.');
    }
  };

  const handleDisconnectProject = async () => {
    try {
      setLocalError(null);
      await supabaseClient.disconnectProject(projectId);

      // Invalidate cache and reload
      invalidateSupabaseStatus(projectId);
      await fetchSupabaseStatus(projectId, true);
    } catch (error) {
      console.error('Failed to disconnect project:', error);
      setLocalError('Failed to disconnect project from Supabase.');
    }
  };

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
                <svg className="w-8 h-8" viewBox="0 0 109 113" fill="none">
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
                  <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
                  <defs>
                    <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#249361"/>
                      <stop offset="1" stopColor="#3ECF8E"/>
                    </linearGradient>
                    <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                      <stop/>
                      <stop offset="1" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Supabase
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Connect your project to Supabase for backend services.
                </p>
              </div>
            </div>
            <a
              href="https://supabase.com/docs"
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
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 ml-9 font-poppins">
                First, connect your Supabase account to access organizations and projects.
              </p>
            </div>
            {connectionStatus?.account ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-poppins text-green-700 dark:text-green-300" style={{ fontWeight: '500' }}>
                    Connected
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnectAccount}
                disabled={isConnecting}
                className="px-4 py-2 rounded-lg font-poppins transition-colors bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? 'Connecting...' : 'Add Account'}
              </button>
            )}
          </div>
        </div>

        {/* Connect Project Section - Step 2 */}
        <div className="border border-gray-200 dark:border-primary rounded-lg p-6 bg-white dark:bg-secondary" style={{ opacity: connectionStatus?.account ? 1 : 0.6 }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-poppins bg-interactive-secondary text-secondary dark:bg-foreground dark:text-background font-bold">
                  2
                </span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 font-poppins">
                  Connect Project
                </h3>
                {isCreatingProject && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Creating...
                  </span>
                )}
                {!currentProjectStatus?.connected && !isCreatingProject && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-poppins bg-gray-100 dark:bg-interactive-secondary text-gray-700 dark:text-gray-300" style={{ fontWeight: '500' }}>
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-gray-400 dark:bg-gray-500"></span>
                    Not connected
                  </span>
                )}
                {currentProjectStatus?.connected && !isCreatingProject && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 ml-9 font-poppins">
                {isCreatingProject
                  ? 'Creating and connecting Supabase project... This may take up to 60 seconds.'
                  : currentProjectStatus?.connected && currentProjectStatus.mapping
                    ? `Connected to ${currentProjectStatus.mapping.supabaseProjectName} in ${currentProjectStatus.mapping.organization.name}`
                    : connectionStatus?.account
                      ? 'Select an organization to connect a Supabase project.'
                      : 'Connect your Supabase account first to enable project sync.'}
              </p>
            </div>
            {currentProjectStatus?.connected ? (
              <div className="flex items-center gap-2">
                <a
                  href={`https://supabase.com/dashboard/project/${currentProjectStatus.mapping?.supabaseProjectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="View Project in Supabase"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={handleDisconnectProject}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 font-poppins transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!connectionStatus?.account) {
                    setLocalError('Please connect your Supabase account first');
                    return;
                  }
                  setShowProjectModal(true);
                }}
                disabled={isConnecting || !connectionStatus?.account}
                className="px-4 py-2 rounded-lg font-poppins transition-colors flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (isConnecting || !connectionStatus?.account) ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? 'Loading...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* Organizations List */}
        {connectionStatus?.account && organizations.length > 0 && (
          <div className="border border-gray-200 dark:border-primary rounded-lg p-6 bg-white dark:bg-secondary">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Organizations
              </h3>
              <button
                onClick={handleSyncOrganizations}
                className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Sync
              </button>
            </div>
            <div className="space-y-2">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-secondary rounded-lg border border-gray-200 dark:border-primary"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {org.organizationName}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {org.role} • {org.projectCount} project
                      {org.projectCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-elevated text-gray-700 dark:text-primary rounded">
                    {org.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Connection Modal */}
      {showProjectModal && (
        <ProjectConnectionModal
          projectId={projectId}
          organizations={organizations}
          onClose={() => setShowProjectModal(false)}
          onSuccess={() => {
            setShowProjectModal(false);
            setLocalError(null);
            // Invalidate cache and reload
            invalidateSupabaseStatus(projectId);
            fetchSupabaseStatus(projectId, true);
          }}
          onError={(errorMessage) => {
            setLocalError(errorMessage);
            setIsCreatingProject(false);
          }}
          onCreatingProject={(isCreating) => {
            setIsCreatingProject(isCreating);
            if (isCreating) {
              setShowProjectModal(false);
              setLocalError(null);
            }
          }}
        />
      )}
    </>
  );
}

interface ProjectConnectionModalProps {
  projectId: string;
  organizations: SupabaseOrganization[];
  onClose: () => void;
  onSuccess: () => void;
  onError?: (errorMessage: string) => void;
  onCreatingProject?: (isCreating: boolean) => void;
}

function ProjectConnectionModal({
  projectId,
  organizations,
  onClose,
  onSuccess,
  onError,
  onCreatingProject,
}: ProjectConnectionModalProps) {
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOrg && mode === 'select') {
      loadProjects(selectedOrg);
    }
  }, [selectedOrg, mode]);

  const loadProjects = async (orgId: string) => {
    try {
      setLoadingProjects(true);
      const { projects: orgProjects } =
        await supabaseClient.getOrganizationProjects(orgId);
      setProjects(orgProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load Supabase projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedOrg) {
      setError('Please select an organization');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === 'select') {
        if (!selectedProject) {
          setError('Please select a project');
          return;
        }
        await supabaseClient.connectProject(
          projectId,
          selectedOrg,
          selectedProject,
        );

        // Track successful Supabase project connection
        trackSupabaseProjectConnected(projectId, selectedProject);

        onSuccess();
      } else {
        // Create mode
        if (!projectName || !dbPassword) {
          setError('Please fill in all required fields');
          setIsSubmitting(false);
          return;
        }

        // Show creating status and close modal
        onCreatingProject?.(true);
        onClose();

        // Run creation in background (don't await here to avoid blocking)
        supabaseClient
          .createAndConnectProject(
            projectId,
            selectedOrg,
            projectName,
            dbPassword,
            region,
          )
          .then(() => {
            // Track successful Supabase project creation and connection
            trackSupabaseProjectConnected(projectId);

            onSuccess();
          })
          .catch((error: any) => {
            console.error('Failed to create project:', error);
            // Pass error to parent component
            onError?.(error.message || 'Failed to create Supabase project');
          })
          .finally(() => {
            onCreatingProject?.(false);
          });

        // Don't set isSubmitting to false here since we're running in background
        return;
      }
    } catch (error: any) {
      console.error('Failed to connect project:', error);
      setError(error.message || 'Failed to connect project');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-secondary rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Connect Supabase Project
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            Select an existing project or create a new one.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Organization Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Organization
          </label>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-gray-100 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-300 focus:border-transparent"
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.75rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em'
            }}
          >
            <option value="">Select organization...</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="text-gray-900 dark:text-gray-100 dark:bg-secondary" >
                {org.organizationName}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        {selectedOrg && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('select')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors border border-gray-300 dark:border-primary ${
                mode === 'select'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-secondary text-gray-700 dark:text-primary'
              }`}
            >
              Existing Project
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors border border-gray-300 dark:border-primary ${
                mode === 'create'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-secondary text-gray-700 dark:text-primary'
              }`}
            >
              Create New
            </button>
          </div>
        )}

        {/* Select Existing Project */}
        {selectedOrg && mode === 'select' && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Supabase Project
            </label>
            {loadingProjects ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : projects.length > 0 ? (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-gray-100 appearance-none text-sm focus:outline-none focus:border-transparent"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="">Select project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.region})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 py-4">
                No projects found. Create a new one instead.
              </p>
            )}
          </div>
        )}

        {/* Create New Project */}
        {selectedOrg && mode === 'create' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-awesome-project"
                className="w-full px-3 py-2 border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Database Password
              </label>
              <input
                type="password"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="Secure password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-900 dark:text-primary appearance-none text-sm focus:outline-none focus:border-transparent"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-1">US West (N. California)</option>
                <option value="eu-west-1">EU West (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-primary text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-primary dark:bg-secondary transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isSubmitting || !selectedOrg}
            className="px-4 py-2 rounded-lg font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : mode === 'create' ? (
              'Create & Connect'
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
