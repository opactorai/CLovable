import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export const useDownload = () => {
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [pairingStatus, setPairingStatus] = useState<
    'idle' | 'pairing' | 'success' | 'error'
  >('idle');
  const [pairingMessage, setPairingMessage] = useState<string | null>(null);
  const pairingAbortRef = useRef<AbortController | null>(null);
  const pairingCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      pairingAbortRef.current?.abort();
    };
  }, []);

  const handleDownload = async (platform: string, userId?: string) => {
    pairingAbortRef.current?.abort();
    pairingCompletedRef.current = false;
    setPairingStatus('idle');
    setPairingMessage(null);
    setDownloadingPlatform(platform);
    setDownloadProgress((prev) => ({ ...prev, [platform]: 0 }));

    // Start progress animation
    const progressInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        const currentProgress = prev[platform] || 0;
        if (currentProgress >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [platform]: Math.min(currentProgress + 1, 95) };
      });
    }, 50);

    try {
      const token = localStorage.getItem('token');

      // If user is logged in, create activation session
      if (token) {
        const activationPayload = await apiClient.createActivation(platform);

        if (!activationPayload?.success) {
          console.warn('Failed to create activation session:', (activationPayload as any)?.message);
        }
      }

      // Get download URL
      const downloadPayload = await apiClient.getDownloadUrl(platform);

      if (!downloadPayload?.success) {
        const message =
          (downloadPayload as any)?.message || 'Failed to resolve download URL';
        throw new Error(message);
      }

      const directDownloadUrl = downloadPayload.data?.downloadUrl;
      if (!directDownloadUrl) {
        throw new Error('Download URL not provided');
      }

      // Complete progress animation before starting download
      clearInterval(progressInterval);
      setDownloadProgress((prev) => ({ ...prev, [platform]: 100 }));

      const anchor = document.createElement('a');
      anchor.href = directDownloadUrl;
      anchor.style.display = 'none';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Wait a moment to show completed state
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const updated = { ...prev };
          delete updated[platform];
          return updated;
        });
      }, 500);
    } catch (error) {
      console.error('Download error:', error);
      clearInterval(progressInterval);
      setDownloadProgress((prev) => {
        const updated = { ...prev };
        delete updated[platform];
        return updated;
      });
      pairingAbortRef.current?.abort();
      pairingAbortRef.current = null;
      if (!pairingCompletedRef.current) {
        setPairingStatus('error');
        setPairingMessage(
          'Automatic pairing failed. Please try again after opening Clink App.',
        );
      }
      alert('Download failed. Please try again.');
    } finally {
      setDownloadingPlatform(null);
    }
  };

  const resetPairingState = () => {
    pairingAbortRef.current?.abort();
    pairingAbortRef.current = null;
    pairingCompletedRef.current = false;
    setPairingStatus('idle');
    setPairingMessage(null);
  };

  return {
    downloadingPlatform,
    downloadProgress,
    pairingStatus,
    pairingMessage,
    handleDownload,
    resetPairingState,
  };
};
