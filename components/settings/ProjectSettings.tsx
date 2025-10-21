/**
 * Project Settings Component (Refactored)
 * Main settings modal with tabs
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FaCog, FaRobot, FaLock, FaPlug } from 'react-icons/fa';
import { SettingsModal } from './SettingsModal';
import { GeneralSettings } from './GeneralSettings';
import { AIAssistantSettings } from './AIAssistantSettings';
import { EnvironmentSettings } from './EnvironmentSettings';
import { ServiceSettings } from './ServiceSettings';
import GlobalSettings from './GlobalSettings';

interface ProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
  initialTab?: SettingsTab;
  onProjectUpdated?: (update: { name: string; description?: string | null }) => void;
}

type SettingsTab = 'general' | 'ai-assistant' | 'environment' | 'services';

export function ProjectSettings({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectDescription = '',
  initialTab = 'general',
  onProjectUpdated,
}: ProjectSettingsProps) {
  const isProjectScoped = Boolean(projectId && projectId !== 'global-settings');

  const tabs = useMemo(
    () =>
      [
        {
          id: 'general' as SettingsTab,
          label: 'General',
          icon: <span className="w-4 h-4 inline-flex"><FaCog /></span>,
          hidden: !isProjectScoped,
        },
        {
          id: 'ai-assistant' as SettingsTab,
          label: 'Agent',
          icon: <span className="w-4 h-4 inline-flex"><FaRobot /></span>,
        },
        {
          id: 'environment' as SettingsTab,
          label: 'Envs',
          icon: <span className="w-4 h-4 inline-flex"><FaLock /></span>,
        },
        {
          id: 'services' as SettingsTab,
          label: 'Services',
          icon: <span className="w-4 h-4 inline-flex"><FaPlug /></span>,
        },
      ].filter(tab => !('hidden' in tab) || !tab.hidden),
    [isProjectScoped]
  );

  const resolvedInitialTab = useMemo<SettingsTab>(() => {
    const availableTabs = tabs.map(tab => tab.id);
    if (initialTab && availableTabs.includes(initialTab)) {
      return initialTab;
    }
    return tabs[0]?.id ?? 'ai-assistant';
  }, [initialTab, tabs]);

  const [activeTab, setActiveTab] = useState<SettingsTab>(resolvedInitialTab);

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  const availableTabs = tabs.length ? tabs : [
    {
      id: 'ai-assistant' as SettingsTab,
      label: 'Agent',
      icon: <span className="w-4 h-4 inline-flex"><FaRobot /></span>,
    },
  ];

  return (
    <>
    <SettingsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Project Settings"
      icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>}
    >
        <div className="flex h-full">
          {/* Sidebar Tabs */}
          <div className="w-56 bg-white border-r border-gray-200 ">
          <nav className="p-4 space-y-1">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 shadow-sm border border-blue-200 '
                    : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900 '
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600 ' : 'text-gray-500 '}>
                  {tab.icon}
                </span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white ">
          {activeTab === 'general' && isProjectScoped && (
            <GeneralSettings
              projectId={projectId}
              projectName={projectName}
              projectDescription={projectDescription ?? ''}
              onProjectUpdated={onProjectUpdated}
            />
          )}
          
          {activeTab === 'ai-assistant' && (
            <AIAssistantSettings projectId={projectId} />
          )}
          
          {activeTab === 'environment' && (
            <EnvironmentSettings projectId={projectId} />
          )}
          
          {activeTab === 'services' && (
            <ServiceSettings 
              projectId={projectId} 
              onOpenGlobalSettings={() => {
                // Open Global Settings with services tab
                setShowGlobalSettings(true);
                onClose(); // Close current modal
              }}
            />
          )}
        </div>
      </div>
    </SettingsModal>
    
    {/* Global Settings Modal */}
    {showGlobalSettings && (
      <GlobalSettings 
        isOpen={showGlobalSettings}
        onClose={() => {
          setShowGlobalSettings(false);
          // Note: We could reopen ProjectSettings here if needed
        }}
        initialTab="services"
      />
    )}
    </>
  );
}

export default ProjectSettings;
