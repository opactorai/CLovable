'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/contexts/BuildThemeContext';

interface MandatoryAIConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManualTokenAdd?: () => void;
}

type Platform = 'darwin' | 'win32';

const PLATFORM_INFO = {
  darwin: {
    name: 'macOS',
    icon: '/assets/download/apple.png',
    extension: 'dmg',
  },
  win32: {
    name: 'Windows',
    icon: '/assets/download/window.png',
    extension: 'exe',
  },
};

export default function MandatoryAIConnectionModal({
  isOpen,
  onClose,
  onManualTokenAdd,
}: MandatoryAIConnectionModalProps) {
  const { theme } = useTheme();
  const [detectedOS, setDetectedOS] = useState<Platform | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: string]: number;
  }>({});

  useEffect(() => {
    // Detect OS and mobile
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;

    // Check if mobile
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    setIsMobile(isMobileDevice);

    // Detect desktop OS
    if (userAgent.indexOf('Mac') !== -1 || platform.indexOf('Mac') !== -1) {
      setDetectedOS('darwin');
    } else if (
      userAgent.indexOf('Win') !== -1 ||
      platform.indexOf('Win') !== -1
    ) {
      setDetectedOS('win32');
    } else {
      // For mobile or unknown OS, set to null to show both buttons
      setDetectedOS(null);
    }
  }, []);

  const handleDownload = async (platform: Platform) => {
    try {
      setDownloadingPlatform(platform);
      setDownloadProgress({ [platform]: 0 });

      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          const current = prev[platform] || 0;
          if (current >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return { ...prev, [platform]: Math.min(current + 10, 90) };
        });
      }, 200);

      const response = await apiClient.getDownloadUrl(platform);

      if (response.success && response.data?.downloadUrl) {
        // Complete progress
        setDownloadProgress({ [platform]: 100 });
        clearInterval(progressInterval);

        // Trigger download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = `clink.${PLATFORM_INFO[platform].extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          setDownloadingPlatform(null);
          setDownloadProgress({});
        }, 2000);
      } else {
        throw new Error('Download URL not available');
      }
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadingPlatform(null);
      setDownloadProgress({});
      alert('Download failed. Please try again.');
    }
  };

  const downloadPlatforms = [
    { platform: 'darwin', label: 'Download for macOS' },
    { platform: 'win32', label: 'Download for Windows' },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl liquid-card shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* AI Providers Section */}
              <div className="mb-8 flex justify-center pt-6">
                <div className="flex flex-col items-center w-[150px] h-[150px] p-6 rounded-xl">
                  <Image
                    src={
                      theme === 'dark'
                        ? '/assets/logo_svg/clink_app_icon_white.svg'
                        : '/assets/logo_svg/clink_app_icon.svg'
                    }
                    alt="Clink Logo"
                    width={150}
                    height={150}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Download Section */}
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <p
                    className={`text-md font-normal font-poppins ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    Download Clink App to link your AI accounts
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {/* Show single button for desktop, both buttons for mobile */}
                  {detectedOS && !isMobile ? (
                    <button
                      onClick={() => handleDownload(detectedOS)}
                      disabled={downloadingPlatform === detectedOS}
                      className={`relative flex items-center gap-3 px-6 py-3 hover:opacity-80
                      rounded-full transition-all duration-200 hover-scale-101
                      disabled:opacity-50 disabled:cursor-not-allowed w-[260px] h-12 ${
                        theme === 'dark' ? 'bg-white' : 'bg-black'
                      }`}
                    >
                      {/* OS Icon */}
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <img
                          src={PLATFORM_INFO[detectedOS].icon}
                          alt={PLATFORM_INFO[detectedOS].name}
                          className="h-5 w-5 object-contain"
                          style={{
                            filter: theme === 'dark' ? 'invert(1)' : 'none',
                          }}
                        />
                      </div>

                      {/* Text Content */}
                      <div className="flex-1 text-center">
                        <span
                          className={`font-normal text-base ${
                            theme === 'dark' ? 'text-black' : 'text-white'
                          }`}
                        >
                          {downloadingPlatform === detectedOS
                            ? 'Downloading...'
                            : `Download for ${PLATFORM_INFO[detectedOS].name}`}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <>
                      {/* macOS Button */}
                      <button
                        onClick={() => handleDownload('darwin')}
                        disabled={downloadingPlatform === 'darwin'}
                        className={`relative flex items-center gap-3 px-6 py-3 hover:opacity-80
                        rounded-full transition-all duration-200 hover-scale-101
                        disabled:opacity-50 disabled:cursor-not-allowed w-[260px] h-12 ${
                          theme === 'dark' ? 'bg-white' : 'bg-black'
                        }`}
                      >
                        {/* OS Icon */}
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <img
                            src="/assets/download/apple.png"
                            alt="macOS"
                            className="h-5 w-5 object-contain"
                            style={{
                              filter: theme === 'dark' ? 'invert(1)' : 'none',
                            }}
                          />
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 text-center">
                          <span
                            className={`font-normal text-base ${
                              theme === 'dark' ? 'text-black' : 'text-white'
                            }`}
                          >
                            {downloadingPlatform === 'darwin'
                              ? 'Downloading...'
                              : 'Download for macOS'}
                          </span>
                        </div>
                      </button>

                      {/* Windows Button */}
                      <button
                        onClick={() => handleDownload('win32')}
                        disabled={downloadingPlatform === 'win32'}
                        className={`relative flex items-center gap-3 px-6 py-3 hover:opacity-80
                        rounded-full transition-all duration-200 hover-scale-101
                        disabled:opacity-50 disabled:cursor-not-allowed w-[260px] h-12 ${
                          theme === 'dark' ? 'bg-white' : 'bg-black'
                        }`}
                      >
                        {/* OS Icon */}
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <img
                            src="/assets/download/window.png"
                            alt="Windows"
                            className="h-5 w-5 object-contain"
                            style={{
                              filter: theme === 'dark' ? 'invert(1)' : 'none',
                            }}
                          />
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 text-center">
                          <span
                            className={`font-normal text-base ${
                              theme === 'dark' ? 'text-black' : 'text-white'
                            }`}
                          >
                            {downloadingPlatform === 'win32'
                              ? 'Downloading...'
                              : 'Download for Windows'}
                          </span>
                        </div>
                      </button>
                    </>
                  )}
                </div>

                {/* Manual Setup Option */}
                <div className="flex justify-center mt-4">
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    or{' '}
                    <button
                      onClick={() => {
                        onManualTokenAdd?.();
                      }}
                      className={`underline hover:opacity-70 transition-opacity ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      setup manually
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
