'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/contexts/BuildThemeContext';

interface ProviderConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvider: 'openai' | 'claude' | 'gemini' | 'zai';
  onSetupManually?: (provider: 'openai' | 'claude' | 'gemini' | 'zai') => void;
}

const PROVIDER_INFO = {
  openai: {
    name: 'ChatGPT',
    logo: '/assets/provider/openai.png',
  },
  claude: {
    name: 'Claude',
    logo: '/assets/provider/claude.png',
  },
  gemini: {
    name: 'Gemini',
    logo: '/assets/provider/gemini.png',
  },
  zai: {
    name: 'Z.ai',
    logo: '', // Will be determined by theme at render time
  },
};

type Platform = 'darwin' | 'win32';

const DOWNLOAD_PLATFORM_INFO = {
  darwin: { name: 'macOS', extension: 'dmg' },
  win32: { name: 'Windows', extension: 'exe' },
};

export default function ProviderConnectionModal({
  isOpen,
  onClose,
  selectedProvider,
  onSetupManually,
}: ProviderConnectionModalProps) {
  const { theme } = useTheme();
  const provider = PROVIDER_INFO[selectedProvider];
  const [downloading, setDownloading] = useState(false);
  const manualLinkColor = theme === 'dark' ? '#a3a3a3' : '#6b7280';

  const detectOS = (): Platform => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;

    if (userAgent.indexOf('Mac') !== -1 || platform.indexOf('Mac') !== -1) {
      return 'darwin';
    } else if (
      userAgent.indexOf('Win') !== -1 ||
      platform.indexOf('Win') !== -1
    ) {
      return 'win32';
    }
    // Linux and other platforms default to macOS
    return 'darwin';
  };

  const handleManualSetup = () => {
    if (!onSetupManually) {
      return;
    }
    onSetupManually(selectedProvider);
    onClose();
  };

  const handleDownloadConnectApp = async () => {
    try {
      setDownloading(true);
      const platform = detectOS();
      const response = await apiClient.getDownloadUrl(platform);

      if (response.success && response.data?.downloadUrl) {
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = `clink.${DOWNLOAD_PLATFORM_INFO[platform].extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('Download URL not available');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className={`${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-3xl text-center w-full max-w-lg mx-4 overflow-hidden`}
              style={{
                boxShadow: theme === 'dark'
                  ? '0 25px 60px rgba(0, 0, 0, 0.5)'
                  : '0 25px 60px rgba(15, 23, 42, 0.08)',
                border: theme === 'dark'
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(15, 23, 42, 0.06)',
              }}
            >
              {/* Header with Provider Info */}
              <div className="px-8 pt-8 pb-6">
                {/* Provider Logo */}
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center"
                  style={{
                    background: theme === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(26, 26, 26, 0.04)',
                  }}
                >
                  {selectedProvider === 'zai' ? (
                    <Image
                      src={theme === 'dark' ? '/assets/agents/zai_light.png' : '/assets/agents/zai_dark.png'}
                      alt={provider.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <img
                      src={provider.logo}
                      alt={provider.name}
                      className="w-12 h-12 object-contain"
                    />
                  )}
                </div>

                {/* Title */}
                <h2
                  className="mb-3"
                  style={{
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
                    fontSize: '24px',
                    fontWeight: '600',
                    letterSpacing: '-0.4px',
                  }}
                >
                  {provider.name} Required
                </h2>

                {/* Description */}
                <p
                  className="mb-0"
                  style={{
                    color: theme === 'dark' ? '#a3a3a3' : '#525252',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    margin: '0 auto',
                  }}
                >
                  {selectedProvider === 'zai' ? (
                    <>
                      Link your {provider.name} account{' '}
                      <button
                        onClick={handleManualSetup}
                        className="underline hover:opacity-70 transition-opacity"
                        style={{
                          color: theme === 'dark' ? '#a3a3a3' : '#525252',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        here
                      </button>
                    </>
                  ) : (
                    <>Link your {provider.name} account in Clink App to continue.</>
                  )}
                </p>
              </div>

              {/* Download & Manual Section */}
              <div className="px-8 pb-8">
                {selectedProvider !== 'zai' && (
                  <button
                    onClick={handleDownloadConnectApp}
                    disabled={downloading}
                    className="text-center text-sm transition-colors duration-200 flex items-center justify-center gap-2 mx-auto"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      color: downloading
                        ? theme === 'dark'
                          ? '#6b7280'
                          : '#9ca3af'
                        : manualLinkColor,
                    }}
                    onMouseEnter={(e) => {
                      if (
                        !downloading &&
                        e.currentTarget instanceof HTMLElement
                      ) {
                        e.currentTarget.style.color =
                          theme === 'dark' ? '#ffffff' : '#374151';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (
                        !downloading &&
                        e.currentTarget instanceof HTMLElement
                      ) {
                        e.currentTarget.style.color = manualLinkColor;
                      }
                    }}
                  >
                    {downloading ? (
                      <>
                        <div
                          className={`w-4 h-4 border-2 rounded-full animate-spin ${
                            theme === 'dark'
                              ? 'border-gray-600 border-t-gray-400'
                              : 'border-gray-300 border-t-gray-500'
                          }`}
                        ></div>
                        Downloading Connect App...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Don't have Connect App? Download here
                      </>
                    )}
                  </button>
                )}
                {onSetupManually && (
                  <div className="flex justify-center mt-4">
                    <span
                      style={{
                        color: manualLinkColor,
                        fontSize: '14px',
                      }}
                    >
                      or{' '}
                      <button
                        onClick={handleManualSetup}
                        className="underline hover:opacity-70 transition-opacity"
                        style={{
                          color: manualLinkColor,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        set up manually
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
