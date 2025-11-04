import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export const useAppMetadata = () => {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [detectedOS, setDetectedOS] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [versionSource, setVersionSource] = useState<string>('');
  const [versionLoading, setVersionLoading] = useState<boolean>(true);

  const detectOS = () => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;

    if (userAgent.indexOf('Mac') !== -1 || platform.indexOf('Mac') !== -1) {
      setDetectedOS('darwin');
    } else if (
      userAgent.indexOf('Win') !== -1 ||
      platform.indexOf('Win') !== -1
    ) {
      setDetectedOS('win32');
    } else {
      setDetectedOS('darwin');
    }
  };

  const fetchAppVersion = async () => {
    try {
      setVersionLoading(true);
      const data = await apiClient.getAppVersion();
      if (data.success && data.data?.version) {
        setAppVersion(data.data.version);
        setVersionSource(data.data.source || 'unknown');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch app version:', error);
      setAppVersion('1.0.14');
      setVersionSource('fallback');
    } finally {
      setVersionLoading(false);
    }
  };

  const fetchGitHubStars = async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/opactorai/Claudable',
      );
      if (response.ok) {
        const repo = await response.json();
        setStarCount(repo.stargazers_count);
      }
    } catch (error) {
      console.error('Failed to fetch GitHub stars:', error);
    }
  };

  useEffect(() => {
    detectOS();
    fetchAppVersion();
    fetchGitHubStars();
  }, []);

  return {
    starCount,
    detectedOS,
    appVersion,
    versionSource,
    versionLoading,
  };
};
