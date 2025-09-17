/**
 * Project Settings Component (Refactored)
 * Main settings modal with tabs
 */
import React, { useState } from 'react';
import { FaCog, FaRobot, FaLock, FaPlug } from 'react-icons/fa';
import { SettingsModal } from './SettingsModal';
import { GeneralSettings } from './GeneralSettings';
import { AIAssistantSettings } from './AIAssistantSettings';
import { EnvironmentSettings } from './EnvironmentSettings';
import { ServiceSettings } from './ServiceSettings';
import GlobalSettings from '@/components/GlobalSettings';

interface ProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialTab?: string;
}

type SettingsTab = 'general' | 'ai-assistant' | 'environment' | 'services';

export function ProjectSettings({
  isOpen,
  onClose,
  projectId,
  projectName,
  initialTab = 'general'
}: ProjectSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab as SettingsTab);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactElement }[] = [
    { id: 'general', label: 'General', icon: <span className="w-4 h-4 inline-flex"><FaCog /></span> },
    { id: 'ai-assistant', label: 'Agent', icon: <span className="w-4 h-4 inline-flex"><FaRobot /></span> },
    { id: 'environment', label: 'Envs', icon: <span className="w-4 h-4 inline-flex"><FaLock /></span> },
    { id: 'services', label: 'Services', icon: <span className="w-4 h-4 inline-flex"><FaPlug /></span> }
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
        <div className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <nav className="p-4 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}>
                  {tab.icon}
                </span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
          {activeTab === 'general' && (
            <GeneralSettings
              projectId={projectId}
              projectName={projectName}
            />
          )}
          
          {activeTab === 'ai-assistant' && (
            <AIAssistantSettings
              projectId={projectId}
              onOpenGlobalSettings={() => {
                // Open Global Settings with ai-agents tab
                setShowGlobalSettings(true);
                onClose(); // Close current modal
              }}
            />
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
        initialTab={activeTab === 'ai-assistant' ? 'ai-agents' : 'services'}
      />
    )}
    </>
  );
}

export default ProjectSettings;