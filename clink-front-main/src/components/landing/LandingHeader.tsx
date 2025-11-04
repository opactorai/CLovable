'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ChevronDown,
  Settings,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { PiUser } from 'react-icons/pi';
import { formatStarCount } from '@/utils/formatting';
import { LogoutConfirmationModal } from '@/components/LogoutConfirmationModal';
import UserSettingsModal from '@/components/UserSettingsModal';

interface LandingHeaderProps {
  isAuthenticated: boolean;
  user: any;
  starCount: number | null;
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (open: boolean) => void;
  handleLogout: () => void;
  handleOpenProjects: () => void;
}

export default function LandingHeader({
  isAuthenticated,
  user,
  starCount,
  profileDropdownOpen,
  setProfileDropdownOpen,
  handleLogout,
  handleOpenProjects,
}: LandingHeaderProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'appearance' | 'billing'>('profile');

  const openLogoutModal = () => {
    setProfileDropdownOpen(false);
    setIsLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    if (isLoggingOut) return;
    setIsLogoutModalOpen(false);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    let didError = false;
    try {
      await Promise.resolve(handleLogout());
    } catch (error) {
      console.error('Logout failed:', error);
      didError = true;
    } finally {
      setIsLoggingOut(false);
      if (!didError) {
        setIsLogoutModalOpen(false);
      }
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 pt-4 bg-transparent w-screen"
    >
      <nav className="relative grid grid-cols-2 items-center px-4 sm:px-6 md:px-8 lg:px-8 py-2 w-full max-w-[1280px] mx-auto min-w-0">
        {/* Logo */}
        <motion.div className="flex items-center flex-shrink-0">
          <Link href="/" className="inline-flex items-center">
            <img
              src="/assets/logo_svg/clink_logo_white.svg"
              alt="Clink Logo"
              className="w-[80px] h-auto sm:hidden"
            />
            <img
              src="/assets/logo_svg/clink_logo_white.svg"
              alt="Clink Logo"
              className="hidden sm:block h-[40px] w-auto max-w-[120px]"
            />
          </Link>
        </motion.div>

        {/* Auth Buttons */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-3 min-w-0">
          {/* GitHub Star Button */}
          <a
            href="https://github.com/opactorai/Claudable"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-white hover:text-gray-300 transition-colors text-xs sm:text-sm font-medium font-poppins min-h-[44px] px-1 sm:px-2"
          >
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {starCount !== null && (
              <span className="font-medium font-poppins">
                {formatStarCount(starCount)}
              </span>
            )}
          </a>

          {isAuthenticated && (
            <button
              onClick={handleOpenProjects}
              className="inline-flex items-center justify-center rounded-full px-3 sm:px-4 text-xs sm:text-sm font-normal h-10 liquid text-white min-h-[44px] whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4 mr-2 text-white" />
              <span className="font-medium font-poppins">Projects</span>
            </button>
          )}

          {isAuthenticated ? (
            <div className="relative profile-dropdown">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-white transition-colors text-xs sm:text-sm font-normal min-h-[44px] liquid rounded-full"
              >
                <PiUser className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span className="truncate max-w-[60px] sm:max-w-[120px] font-medium font-poppins">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </span>
                <ChevronDown
                  className={`w-3 h-3 sm:w-4 sm:h-4 text-white transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-48 sm:w-56 rounded-lg z-[60]"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, #bbbbbc 12%, transparent)',
                    backdropFilter: 'blur(8px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(8px) saturate(150%)',
                    boxShadow: `
                      inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
                      inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
                      inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
                      inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
                      inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
                      inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
                      inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
                      inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
                      0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
                      0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
                    `,
                    transition:
                      'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)',
                  }}
                >
                  <div className="px-3 sm:px-4 py-3 border-b border-gray-200">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-white truncate">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSettingsInitialTab('profile');
                        setIsSettingsModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm text-white hover:bg-white/10 transition-colors min-h-[44px] rounded-md"
                    >
                      <PiUser className="w-4 h-4 flex-shrink-0" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSettingsInitialTab('appearance');
                        setIsSettingsModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm text-white hover:bg-white/10 transition-colors min-h-[44px] rounded-md"
                    >
                      <Settings className="w-4 h-4 flex-shrink-0" />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-white/20 pt-1 px-1 pb-1.5">
                    <button
                      onClick={openLogoutModal}
                      className="flex items-center gap-2 px-3 sm:px-4 py-3 w-full text-left text-xs sm:text-sm text-white hover:bg-white/10 transition-colors min-h-[44px] rounded-md"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="relative hover:scale-105"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                height: '44px',
                boxSizing: 'border-box',
                padding: '6px 16px',
                borderRadius: '99em',
                fontSize: '12px',
                backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
                backdropFilter: 'blur(8px) saturate(150%)',
                WebkitBackdropFilter: 'blur(8px) saturate(150%)',
                boxShadow: `
                inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
                inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
                inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
                inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
                inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
                inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
                inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
                inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
                0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
                0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
              `,
                transition:
                  'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
            >
              <span className="text-white transition-colors text-xs sm:text-sm font-normal font-poppins">
                Sign up
              </span>
            </Link>
          )}
        </div>
      </nav>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        isLoading={isLoggingOut}
        onCancel={closeLogoutModal}
        onConfirm={handleConfirmLogout}
      />

      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        userPlan={user?.plan}
      />
    </motion.header>
  );
}
