'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Palette, CreditCard } from 'lucide-react';
import { PiUser } from 'react-icons/pi';
import ProfileTab from './settings/tabs/ProfileTab';
import AppearanceTab from './settings/tabs/AppearanceTab';
import BillingTab from './settings/tabs/BillingTab';
import type { UserPlan } from '@/types/user';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  userPlan?: UserPlan;
}

type SettingsTab = 'profile' | 'appearance' | 'billing';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'profile', label: 'Profile', icon: PiUser },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'billing', label: 'Plans & Billing', icon: CreditCard },
];

export default function UserSettingsModal({
  isOpen,
  onClose,
  initialTab = 'profile',
  userPlan = 'free',
}: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'appearance':
        return <AppearanceTab />;
      case 'billing':
        return <BillingTab />;
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
                  Settings
                </h2>
                <p className="text-sm text-secondary">
                  Manage your account
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
                      General
                    </h3>
                    <div className="space-y-1">
                      {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
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
                  {TABS.find((tab) => tab.id === activeTab)?.label}
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
