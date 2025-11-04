'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { trackProjectPublished, trackProjectPublishUpdated } from '@/lib/analytics';
import type { PublishState } from '../components/PublishModal';

interface PublishControlsOptions {
  projectId: string;
  project: any | null;
  projectName: string | null | undefined;
  fetchDeploymentStatus: () => Promise<any>;
  publishProject: (subdomain: string, customDomainId?: string) => Promise<void>;
  refreshProjectAndTrack: () => Promise<any>;
  notifyActivity: (event: string, metadata?: Record<string, unknown>) => void;
}

interface PublishControlsResult {
  isPublishPanelOpen: boolean;
  setIsPublishPanelOpen: (value: boolean) => void;
  publishState: PublishState;
  deploymentError: string | null;
  subdomainName: string;
  setSubdomainName: (
    value: string,
    options?: { source?: 'auto' | 'user' | 'reset' },
  ) => void;
  publishDomain: string;
  handleSubdomainChange: (value: string) => void;
  currentDeploymentSubdomain: string | null;
  setCurrentDeploymentSubdomain: (value: string | null) => void;
  handlePublishButtonClick: () => void;
  handlePublishPanelClose: () => void;
  handleUpdatePublish: (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => void;
  handleUnpublish: (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => Promise<void>;
}

const slugifyProjectName = (name: string | null | undefined) => {
  if (!name || name === '•••') {
    return '';
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
};

export function usePublishControls({
  projectId,
  project,
  projectName,
  fetchDeploymentStatus,
  publishProject,
  refreshProjectAndTrack,
  notifyActivity,
}: PublishControlsOptions): PublishControlsResult {
  const [isPublishPanelOpen, setIsPublishPanelOpen] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [hasTriggeredInitialPublish, setHasTriggeredInitialPublish] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [isPollingDeployment, setIsPollingDeployment] = useState(false);
  const [subdomainName, setSubdomainNameState] = useState<string>('');
  const [isSubdomainUserLocked, setIsSubdomainUserLocked] = useState(false);
  const [currentDeploymentSubdomain, setCurrentDeploymentSubdomain] =
    useState<string | null>(null);

  const setSubdomainName = useCallback(
    (
      value: string,
      options?: { source?: 'auto' | 'user' | 'reset' },
    ) => {
      setSubdomainNameState(value);
      if (options?.source === 'user') {
        setIsSubdomainUserLocked(true);
      } else if (options?.source === 'reset') {
        setIsSubdomainUserLocked(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!projectName || projectName === '•••') {
      return;
    }

    const slug = slugifyProjectName(projectName);
    if (!slug) {
      return;
    }

    if (!subdomainName) {
      setSubdomainName(slug, { source: 'auto' });
      return;
    }

    if (!isSubdomainUserLocked && subdomainName !== slug) {
      setSubdomainName(slug, { source: 'auto' });
    }
  }, [projectName, subdomainName, isSubdomainUserLocked, setSubdomainName]);

  // Check subdomain availability when publish modal opens
  useEffect(() => {
    if (!isPublishPanelOpen || !subdomainName || currentDeploymentSubdomain === subdomainName) {
      return;
    }

    const checkAndUpdateSubdomain = async () => {
      try {
        const availability = await apiClient.checkSubdomainAvailability(subdomainName);

        if (!availability?.available) {
          // Auto-generate a unique subdomain by appending random characters
          const generateRandomSuffix = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let suffix = '';
            for (let i = 0; i < 4; i++) {
              suffix += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return suffix;
          };

          // Try up to 5 times to find an available subdomain
          let attempts = 0;
          let found = false;
          while (attempts < 5 && !found) {
            const suffix = generateRandomSuffix();
            const newSubdomain = `${subdomainName}-${suffix}`;

            try {
              const newAvailability = await apiClient.checkSubdomainAvailability(newSubdomain);
              if (newAvailability?.available) {
                setSubdomainName(newSubdomain, { source: 'auto' });
                found = true;
                break;
              }
            } catch (err) {
              console.error('Failed to check availability for', newSubdomain, err);
            }

            attempts++;
          }

          if (!found) {
            console.warn('Could not find available subdomain after 5 attempts');
          }
        }
      } catch (error) {
        console.error('Failed to check subdomain availability:', error);
      }
    };

    void checkAndUpdateSubdomain();
  }, [isPublishPanelOpen, subdomainName, currentDeploymentSubdomain, setSubdomainName]);

  const publishDomain = useMemo(() => {
    const domainSuffix = (project as any)?.deploymentDomainSuffix || 'clinks.app';
    if (subdomainName) {
      return `${subdomainName}.${domainSuffix}`;
    }
    const slug = slugifyProjectName(projectName);
    if (slug) {
      return `${slug}.${domainSuffix}`;
    }
    return projectId ? `project-${projectId}.${domainSuffix}` : domainSuffix;
  }, [project, projectId, projectName, subdomainName]);

  const handleSubdomainChange = useCallback(
    (value: string) => {
      setSubdomainName(value, { source: 'user' });
      setDeploymentError(null);
    },
    [setSubdomainName],
  );

  useEffect(() => {
    if (project?.productionUrl && publishState !== 'deploying') {
      setPublishState('live');
      setDeploymentError(null);
      setHasTriggeredInitialPublish(true);
    }
  }, [project?.productionUrl, publishState]);

  useEffect(() => {
    if (!projectId) return;

    const loadDeploymentInfo = async () => {
      try {
        const statusData = await fetchDeploymentStatus();
        const deployment = statusData?.deployment;

        if (deployment?.subdomainName && deployment.status === 'success') {
          setSubdomainName(deployment.subdomainName, { source: 'user' });
          setCurrentDeploymentSubdomain(deployment.subdomainName);
        }
      } catch (error) {
        console.error('Failed to load deployment info:', error);
      }
    };

    void loadDeploymentInfo();
  }, [projectId, fetchDeploymentStatus, setSubdomainName]);

  const pollDeploymentStatus = useCallback(async () => {
    if (isPollingDeployment) {
      return;
    }

    setIsPollingDeployment(true);

    try {
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        try {
          const statusData = await fetchDeploymentStatus();
          const deployment = statusData?.deployment;

          if (!deployment) {
            continue;
          }

          if (deployment.status === 'success') {
            const isFirstPublish = !currentDeploymentSubdomain;

            if (deployment.subdomainName) {
              setCurrentDeploymentSubdomain(deployment.subdomainName);
              setSubdomainName(deployment.subdomainName, { source: 'user' });

              if (isFirstPublish) {
                trackProjectPublished(projectId, deployment.subdomainName, true);
              } else {
                trackProjectPublishUpdated(projectId, deployment.subdomainName);
              }
            }
            setPublishState('live');
            setDeploymentError(null);
            setHasTriggeredInitialPublish(true);
            await refreshProjectAndTrack();
            return;
          }

          if (deployment.status === 'failed') {
            setPublishState('error');
            setDeploymentError(
              deployment.errorMessage || 'Deployment failed. Please try again.',
            );
            setHasTriggeredInitialPublish(false);
            return;
          }

          setPublishState('deploying');
        } catch (statusError) {
          console.error('Failed to fetch deployment status:', statusError);
          if (attempt === maxAttempts - 1) {
            throw statusError;
          }
        }
      }

      setPublishState('error');
      setDeploymentError('Timed out waiting for deployment status. Please try again soon.');
      setHasTriggeredInitialPublish(false);
    } finally {
      setIsPollingDeployment(false);
    }
  }, [
    currentDeploymentSubdomain,
    fetchDeploymentStatus,
    isPollingDeployment,
    projectId,
    refreshProjectAndTrack,
    setSubdomainName,
  ]);

  const startDeployment = useCallback(async (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => {
    if (!projectId || publishState === 'deploying') {
      return;
    }

    if (!subdomainName) {
      setDeploymentError('Please enter a subdomain name');
      return;
    }

    if (
      !currentDeploymentSubdomain ||
      currentDeploymentSubdomain !== subdomainName
    ) {
      try {
        const availability = await apiClient.checkSubdomainAvailability(
          subdomainName,
        );
        if (!availability?.available) {
          const domainSuffix = (project as any)?.deploymentDomainSuffix || 'clinks.app';
          const conflictMessage = `${subdomainName}.${domainSuffix} is already in use. Select Edit next to Website Address and pick a different address.`;
          setPublishState('error');
          setDeploymentError(conflictMessage);
          setHasTriggeredInitialPublish(false);
          setIsPublishPanelOpen(true);
          return;
        }
      } catch (availabilityError) {
        console.error(
          'Failed to check subdomain availability:',
          availabilityError,
        );
      }
    }

    setPublishState('deploying');
    setDeploymentError(null);

    try {
      // Pass customDomainId if a custom domain is selected
      const customDomainId = target?.type === 'custom' ? target.domainId : undefined;
      await publishProject(subdomainName, customDomainId);
      await pollDeploymentStatus();
    } catch (error) {
      console.error('Error starting deployment:', error);
      if (error instanceof Error && error.message.includes('409')) {
        setPublishState('deploying');
        setDeploymentError(null);
        await pollDeploymentStatus();
        return;
      }

      const errorMessage = error instanceof Error ? error.message : '';
      const isSubdomainConflict =
        errorMessage.includes('already taken') ||
        errorMessage.includes('Subdomain') ||
        errorMessage.includes('already in use');

      const domainSuffix = (project as any)?.deploymentDomainSuffix || 'clinks.app';
      setPublishState('error');
      setDeploymentError(
        isSubdomainConflict
          ? `${subdomainName}.${domainSuffix} is already in use. Select Edit next to Website Address and pick a different address.`
          : error instanceof Error
          ? error.message
          : 'Failed to start deployment. Please try again.',
      );
      setHasTriggeredInitialPublish(false);
    }
  }, [
    currentDeploymentSubdomain,
    pollDeploymentStatus,
    project,
    projectId,
    publishProject,
    publishState,
    subdomainName,
  ]);

  const handlePublishButtonClick = useCallback(() => {
    if (!isPublishPanelOpen) {
      notifyActivity('project:publish', { autoStart: false });
      setIsPublishPanelOpen(true);
    } else {
      setIsPublishPanelOpen(false);
    }
  }, [
    isPublishPanelOpen,
    notifyActivity,
  ]);

  const handleUpdatePublish = useCallback((target?: { type: 'subdomain' | 'custom'; domainId?: string }) => {
    if (publishState === 'deploying') {
      return;
    }
    notifyActivity('project:publish', { autoStart: false });
    setIsPublishPanelOpen(true);
    setHasTriggeredInitialPublish(true);
    void startDeployment(target);
  }, [notifyActivity, publishState, startDeployment]);

  const handlePublishPanelClose = useCallback(() => {
    setIsPublishPanelOpen(false);
  }, []);

  const handleUnpublish = useCallback(async (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => {
    if (!projectId) return;

    try {
      setPublishState('removing' as PublishState);

      // Use selective unpublishing based on target
      if (target?.type === 'custom' && target.domainId) {
        // Unpublish specific custom domain only
        await apiClient.unpublishProject(projectId, {
          customDomainId: target.domainId,
        });
        setPublishState('live'); // Keep live state since subdomain is still deployed
      } else {
        // Unpublish the subdomain only
        await apiClient.unpublishProject(projectId, {
          unpublishSubdomain: true,
        });

        // Refresh deployment status to ensure UI is updated
        try {
          const statusData = await fetchDeploymentStatus();
          const deployment = statusData?.deployment;

          // Check if deployment is archived or no longer active
          if (!deployment || deployment.status === 'archived') {
            setPublishState('idle');
            setCurrentDeploymentSubdomain(null);
          }
        } catch (statusError) {
          console.error('Failed to fetch deployment status after unpublish:', statusError);
          // Still set to idle even if status fetch fails
          setPublishState('idle');
        }
      }

      setDeploymentError(null);
      setHasTriggeredInitialPublish(false);

      // Refresh project data
      await refreshProjectAndTrack();

      // Close modal after successful unpublish
      setIsPublishPanelOpen(false);
    } catch (error) {
      console.error('Failed to unpublish:', error);
      setPublishState('error');
      setDeploymentError(
        error instanceof Error
          ? error.message
          : 'Failed to unpublish. Please try again.'
      );
    }
  }, [projectId, refreshProjectAndTrack, fetchDeploymentStatus]);

  return {
    isPublishPanelOpen,
    setIsPublishPanelOpen,
    publishState,
    deploymentError,
    subdomainName,
    setSubdomainName,
    publishDomain,
    handleSubdomainChange,
    currentDeploymentSubdomain,
    setCurrentDeploymentSubdomain,
    handlePublishButtonClick,
    handlePublishPanelClose,
    handleUpdatePublish,
    handleUnpublish,
  };
}
