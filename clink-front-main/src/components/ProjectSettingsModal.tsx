'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  UserCheck,
  FileCode,
  Package,
  Github,
  BarChart3,
  Boxes,
  Palette,
} from 'lucide-react';
import { githubClient } from '@/lib/github-client';
import ProjectSettingsTab from './settings/tabs/ProjectSettingsTab';
import CustomTab from './settings/tabs/CustomTab';
import WorkspaceTab from './settings/tabs/WorkspaceTab';
import BillingTab from './settings/tabs/BillingTab';
import IntegrationsTab from './settings/tabs/IntegrationsTab';
import AppearanceTab from './settings/tabs/AppearanceTab';
import type { UserPlan } from '@/types/user';

interface GitHubConnectionStatus {
  connected: boolean;
  installation?: { targetLogin: string };
  githubUsername?: string;
  hasOAuthToken?: boolean;
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  projectCreatedAt?: string | Date | null;
  onProjectUpdate?: () => void;
  initialTab?: SettingsTab;
  initialIntegration?: 'supabase' | 'github' | 'other-apps' | null;
  userPlan?: UserPlan;
  projectType?: 'base' | 'dev';
}


type SettingsTab =
  | 'project'
  | 'custom'
  | 'workspace'
  | 'billing'
  | 'appearance'
  | 'integrations';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const TABS: TabConfig[] = [
  { id: 'project', label: 'Project Settings', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'custom', label: 'Custom', icon: UserCheck },
  { id: 'billing', label: 'Plans & Billing', icon: FileCode },
];

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Todo App',
  projectCreatedAt,
  onProjectUpdate,
  initialTab = 'project',
  initialIntegration = null,
  userPlan = 'free',
  projectType = 'base',
}: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [activeIntegration, setActiveIntegration] = useState<
    'supabase' | 'github' | 'other-apps' | null
  >(initialIntegration);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);

  const refreshConnectedAccount = useCallback(async (forceRefresh = false) => {
    try {
      const status: GitHubConnectionStatus =
        await githubClient.getConnectionStatus({ forceRefresh });
      if (status?.connected) {
        setConnectedAccount(
          status.installation?.targetLogin || status.githubUsername || null,
        );
      } else {
        setConnectedAccount(null);
      }
    } catch (error) {
      console.error('Failed to refresh GitHub connection status:', error);
      setConnectedAccount(null);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConnectedAccount(null);
      return;
    }

    const sanitizedInitialIntegration =
      projectType === 'dev' && initialIntegration === 'supabase'
        ? 'github'
        : initialIntegration;

    // Set initial tab when modal opens
    setActiveTab(initialTab);
    if (initialTab === 'integrations') {
      setActiveIntegration(sanitizedInitialIntegration ?? 'github');
    } else {
      setActiveIntegration(null);
    }

    // Always force refresh when modal opens to get the latest data for current user
    refreshConnectedAccount(true);
  }, [initialIntegration, initialTab, isOpen, refreshConnectedAccount, projectType]);

  const handleDisconnectAccount = useCallback(async () => {
    try {
      await githubClient.disableProjectSync(projectId);
      githubClient.invalidateConnectionStatusCache();
      await refreshConnectedAccount(true);
    } catch (error) {
      console.error('Failed to disconnect GitHub project sync:', error);
    }
  }, [projectId, refreshConnectedAccount]);

  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId);
    if (tabId !== 'integrations') {
      setActiveIntegration(null);
    }
  };

  const handleIntegrationClick = (
    integration: 'supabase' | 'github' | 'other-apps',
  ) => {
    if (projectType === 'dev' && integration === 'supabase') {
      setActiveTab('integrations');
      setActiveIntegration('github');
      return;
    }

    setActiveTab('integrations');
    setActiveIntegration(integration);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'project':
        return (
          <ProjectSettingsTab
            projectId={projectId}
            projectName={projectName}
            createdAt={projectCreatedAt}
            onProjectUpdate={onProjectUpdate}
          />
        );
      case 'appearance':
        return <AppearanceTab />;
      case 'custom':
        return <CustomTab projectId={projectId} userPlan={userPlan} />;
      case 'billing':
        return <BillingTab projectId={projectId} />;
      case 'integrations':
        if (projectType === 'dev' && activeIntegration === 'supabase') {
          return (
            <IntegrationsTab
              activeIntegration="github"
              setActiveIntegration={setActiveIntegration}
              projectId={projectId}
              hideSupabase
            />
          );
        }
        return (
          <IntegrationsTab
            activeIntegration={activeIntegration}
            setActiveIntegration={setActiveIntegration}
            projectId={projectId}
            hideSupabase={projectType === 'dev'}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 p-4 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="bg-secondary rounded-3xl w-full max-w-5xl h-[85vh] overflow-hidden flex font-poppins border border-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="w-80 border-r border-primary flex flex-col">
              <div className="px-8 py-6">
                <h2
                  className="mb-1 text-primary"
                  style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    letterSpacing: '-0.4px',
                  }}
                >
                  {projectName}
                </h2>
                <p
                  className="text-sm text-secondary"
                >
                  Project Settings
                </p>
              </div>

              <nav className="flex-1 px-6 py-8 overflow-y-auto">
                <div className="space-y-2">
                  <div>
                    <h3
                      className="text-xs mb-3 px-3 font-poppins text-tertiary"
                      style={{
                        fontWeight: '500',
                      }}
                    >
                      Project
                    </h3>
                    <div className="space-y-1">
                      {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all font-poppins ${
                              activeTab === tab.id
                                ? 'bg-interactive-secondary text-primary'
                                : 'text-secondary hover:bg-interactive-hover'
                            }`}
                            style={{
                              fontWeight: activeTab === tab.id ? '500' : '400',
                              fontSize: '14px',
                            }}
                          >
                            <Icon className="w-4 h-4" strokeWidth={2} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6">
                    <h3
                      className="text-xs mb-3 px-3 font-poppins text-gray-500 dark:text-gray-400"
                      style={{
                        fontWeight: '500',
                      }}
                    >
                      Integrations
                    </h3>
                    <div className="space-y-1">
                      {projectType !== 'dev' && (
                      <button
                        onClick={() => handleIntegrationClick('supabase')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all font-poppins ${
                          activeTab === 'integrations' &&
                          activeIntegration === 'supabase'
                            ? 'bg-interactive-secondary text-primary'
                            : 'text-secondary hover:bg-interactive-hover'
                        }`}
                        style={{
                          fontWeight:
                            activeTab === 'integrations' &&
                            activeIntegration === 'supabase'
                              ? '500'
                              : '400',
                          fontSize: '14px',
                        }}
                      >
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 109 113"
                          fill="none"
                        >
                          <path
                            d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
                            fill="url(#paint0_linear)"
                          />
                          <path
                            d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
                            fill="url(#paint1_linear)"
                            fillOpacity="0.2"
                          />
                          <path
                            d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
                            fill="#3ECF8E"
                          />
                          <defs>
                            <linearGradient
                              id="paint0_linear"
                              x1="53.9738"
                              y1="54.974"
                              x2="94.1635"
                              y2="71.8295"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stopColor="#249361" />
                              <stop offset="1" stopColor="#3ECF8E" />
                            </linearGradient>
                            <linearGradient
                              id="paint1_linear"
                              x1="36.1558"
                              y1="30.578"
                              x2="54.4844"
                              y2="65.0806"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop />
                              <stop offset="1" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                        </svg>
                        Supabase
                      </button>
                      )}
                      <button
                        onClick={() => handleIntegrationClick('github')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all font-poppins ${
                          activeTab === 'integrations' &&
                          activeIntegration === 'github'
                            ? 'bg-interactive-secondary text-primary'
                            : 'text-secondary hover:bg-interactive-hover'
                        }`}
                        style={{
                          fontWeight:
                            activeTab === 'integrations' &&
                            activeIntegration === 'github'
                              ? '500'
                              : '400',
                          fontSize: '14px',
                        }}
                      >
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        GitHub
                      </button>
                      <button
                        onClick={() => handleIntegrationClick('other-apps')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all font-poppins ${
                          activeTab === 'integrations' &&
                          activeIntegration === 'other-apps'
                            ? 'bg-interactive-secondary text-primary'
                            : 'text-secondary hover:bg-interactive-hover'
                        }`}
                        style={{
                          fontWeight:
                            activeTab === 'integrations' &&
                            activeIntegration === 'other-apps'
                              ? '500'
                              : '400',
                          fontSize: '14px',
                        }}
                      >
                        <Boxes className="w-4 h-4" />
                        Other Apps
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-8 py-5 border-b border-primary">
                <h3
                  className="font-poppins text-primary"
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {TABS.find((tab) => tab.id === activeTab)?.label ||
                    (activeTab === 'integrations' ? 'Integrations' : '')}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-interactive-hover rounded-lg transition-colors text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-hide">
                {renderTabContent()}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
