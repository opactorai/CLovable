'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe,
  Loader2,
  ShieldAlert,
  X,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { WebsiteInfoModal } from './WebsiteInfoModal';
import FullUpgradeModal from '@/components/FullUpgradeModal';

export type PublishState = 'idle' | 'deploying' | 'live' | 'error' | 'removing';

interface CustomDomain {
  id: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  verifiedIp?: string;
  lastVerifiedAt?: string;
  verificationError?: string;
  createdAt: string;
  sslStatus?: string;
  isDeployed?: boolean;
}

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: PublishState;
  websiteAddress: string;
  subdomainName: string;
  onSubdomainChange: (subdomain: string) => void;
  onUpdateClick: (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => void;
  onUnpublishClick: (target?: { type: 'subdomain' | 'custom'; domainId?: string }) => void;
  canUpdate: boolean;
  canUnpublish: boolean;
  errorMessage?: string | null;
  panelRef?: React.Ref<HTMLDivElement>;
  onOpenCustomDomain?: () => void;
  currentSubdomain?: string | null;
  onOpenAnalytics?: () => void;
  domainSuffix?: string;
  projectId: string;
  projectType?: 'base' | 'dev';
  productionUrl?: string | null;
  railwayProjectId?: string | null;
  railwayServiceId?: string | null;
  expectedDomain?: string;
  railwayDeploymentStatus?: 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED' | null;
  railwayMessage?: string;
  railwayUrl?: string | null;
  railwayErrorLogs?: string | null;
  onCheckRailwayStatus?: () => Promise<void>;
  onSendPromptToAgent?: (prompt: string) => void;
  onRailwayUnpublishSuccess?: () => Promise<void>;
  onRailwayDeploySuccess?: () => Promise<void>;
  userPlan?: 'free' | 'pro' | 'full';
}

const statusBadgeStyles: Record<PublishState, string> = {
  idle: 'bg-gray-200 text-gray-800',
  deploying: 'bg-amber-200 text-amber-800',
  live: 'bg-emerald-200 text-emerald-800',
  error: 'bg-red-200 text-red-800',
  removing: 'bg-amber-200 text-amber-800',
};

const statusLabel: Record<PublishState, string> = {
  idle: 'Draft',
  deploying: 'Publishing',
  live: 'Live',
  error: 'Error',
  removing: 'Removing',
};

const debounce = <T extends (...args: any[]) => any>(func: T, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export function PublishModal({
  isOpen,
  onClose,
  state,
  websiteAddress,
  subdomainName,
  onSubdomainChange,
  onUpdateClick,
  onUnpublishClick,
  canUpdate,
  canUnpublish,
  errorMessage,
  panelRef,
  onOpenCustomDomain,
  currentSubdomain,
  onOpenAnalytics,
  domainSuffix = 'clinks.app',
  projectId,
  projectType,
  productionUrl,
  railwayProjectId,
  railwayServiceId,
  expectedDomain,
  railwayDeploymentStatus: propRailwayDeploymentStatus,
  railwayMessage: propRailwayMessage,
  railwayUrl: propRailwayUrl,
  railwayErrorLogs: propRailwayErrorLogs,
  onCheckRailwayStatus,
  onSendPromptToAgent,
  onRailwayUnpublishSuccess,
  onRailwayDeploySuccess,
  userPlan = 'free',
}: PublishModalProps) {
  const isImportMode = projectType === 'dev';
  const isDeploying = state === 'deploying';
  const isActionDisabled = !canUpdate || state === 'deploying' || state === 'removing';

  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingUnpublish, setIsConfirmingUnpublish] = useState(false);
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>([]);
  const [selectedDeployTarget, setSelectedDeployTarget] = useState<{
    type: 'subdomain' | 'custom';
    domainId?: string;
  }>({ type: 'subdomain' });
  const [isWebsiteInfoModalOpen, setIsWebsiteInfoModalOpen] = useState(false);
  const [showFullUpgradeModal, setShowFullUpgradeModal] = useState(false);
  const unpublishSectionRef = useRef<HTMLDivElement | null>(null);

  // Use Railway state from props
  const railwayDeploymentStatus = propRailwayDeploymentStatus;
  const railwayMessage = propRailwayMessage ?? '';
  const railwayUrl = propRailwayUrl;
  const railwayErrorLogs = propRailwayErrorLogs;
  const [fixWithAiClicked, setFixWithAiClicked] = useState(false);
  const [isDeployingRailway, setIsDeployingRailway] = useState(false);
  const [isUnpublishingRailway, setIsUnpublishingRailway] = useState(false);
  const [railwayDeployError, setRailwayDeployError] = useState<string | null>(null);

  // Reset fixWithAiClicked and deploy error when modal opens
  useEffect(() => {
    if (isOpen) {
      setFixWithAiClicked(false);
      setRailwayDeployError(null);
    }
  }, [isOpen]);

  const friendlyErrorMessage = useMemo(() => {
    if (!errorMessage) {
      return null;
    }

    const normalized = errorMessage.toLowerCase();
    const hasHostConflict =
      normalized.includes('host already exists') ||
      normalized.includes('already taken') ||
      normalized.includes('record with that host') ||
      normalized.includes('dns record');

    if (hasHostConflict) {
      const suffix = subdomainName ? `${subdomainName}.${domainSuffix}` : 'This host name';
      return `${suffix} is already in use. Select Edit next to Website Address and pick a different address.`;
    }

    return errorMessage;
  }, [errorMessage, subdomainName, domainSuffix]);

  const displayErrorMessage = friendlyErrorMessage || 'Deployment failed. Please try again.';
  const shouldShowErrorIcon = !friendlyErrorMessage || friendlyErrorMessage === errorMessage;

  const isValidSubdomain = useMemo(() => {
    if (!subdomainName) return false;
    return /^[a-z0-9-]{3,63}$/.test(subdomainName);
  }, [subdomainName]);

  const checkAvailability = useMemo(
    () =>
      debounce(async (name: string) => {
        if (!name || !isValidSubdomain) {
          setIsAvailable(null);
          return;
        }

        setIsCheckingAvailability(true);
        try {
          const result = await apiClient.checkSubdomainAvailability(name);
          setIsAvailable(result.available);
        } catch (error) {
          console.error('Failed to check subdomain availability:', error);
          setIsAvailable(null);
        } finally {
          setIsCheckingAvailability(false);
        }
      }, 300),
    [isValidSubdomain],
  );

  useEffect(() => {
    if (isImportMode) {
      return;
    }

    if (!subdomainName || !isEditing) {
      return;
    }

    const isSameAsCurrent =
      currentSubdomain && subdomainName === currentSubdomain && isValidSubdomain;

    if (isSameAsCurrent) {
      setIsCheckingAvailability(false);
      setIsAvailable(true);
      return;
    }

    checkAvailability(subdomainName);
  }, [isImportMode, subdomainName, checkAvailability, isEditing, currentSubdomain, isValidSubdomain]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setIsAvailable(null);
      setIsConfirmingUnpublish(false);
      return;
    }

    if (isImportMode) {
      // Check Railway deployment status if project exists and we don't have data yet
      if (railwayProjectId && railwayServiceId && !railwayDeploymentStatus && onCheckRailwayStatus) {
        void onCheckRailwayStatus();
      }
      return;
    }

    const loadCustomDomains = async () => {
      try {
        const domains = await apiClient.getProjectDomains(projectId);
        setCustomDomains(domains ?? []);
      } catch (error) {
        console.error('Failed to load custom domains:', error);
        setCustomDomains([]);
      }
    };

    void loadCustomDomains();
  }, [isOpen, isImportMode, railwayProjectId, railwayServiceId, railwayDeploymentStatus, onCheckRailwayStatus, projectId]);

  useEffect(() => {
    if (isImportMode) {
      return;
    }

    if (state === 'live' && projectId && isOpen) {
      const loadCustomDomains = async () => {
        try {
          const domains = await apiClient.getProjectDomains(projectId);
          setCustomDomains(domains ?? []);
        } catch (error) {
          console.error('Failed to reload custom domains:', error);
        }
      };

      void loadCustomDomains();
    }
  }, [state, projectId, isOpen, isImportMode]);

  useEffect(() => {
    if (!isConfirmingUnpublish) {
      return;
    }

    const handleClickAway = (event: MouseEvent) => {
      if (!unpublishSectionRef.current || unpublishSectionRef.current.contains(event.target as Node)) {
        return;
      }
      setIsConfirmingUnpublish(false);
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isConfirmingUnpublish]);

  const handleCancelUnpublishConfirm = () => {
    setIsConfirmingUnpublish(false);
  };

  const handleConfirmUnpublish = async () => {
    setIsConfirmingUnpublish(false);

    if (isImportMode) {
      setIsUnpublishingRailway(true);
      try {
        await apiClient.unpublishRailway(projectId);

        // Refresh project data to update UI immediately
        if (onRailwayUnpublishSuccess) {
          await onRailwayUnpublishSuccess();
        }
      } catch (error: any) {
        console.error('Failed to unpublish Railway deployment:', error);
        // Parent hook will handle error state via checkRailwayDeploymentStatus
        if (onCheckRailwayStatus) {
          await onCheckRailwayStatus();
        }
      } finally {
        setIsUnpublishingRailway(false);
      }
      return;
    }

    onUnpublishClick(selectedDeployTarget);
  };

  const handleRailwayDeploy = async () => {
    // Check if user has FULL plan
    if (userPlan !== 'full') {
      setShowFullUpgradeModal(true);
      return;
    }

    setIsDeployingRailway(true);
    setRailwayDeployError(null);
    try {
      await apiClient.deployRailway(projectId);

      // Trigger status check to start polling
      if (onCheckRailwayStatus) {
        await onCheckRailwayStatus();
      }
    } catch (error: any) {
      console.error('API request failed:', error);
      console.error('Deployment failed:', error);

      // Extract user-friendly error message
      let errorMessage = 'Deployment failed. Please try again.';
      if (error?.message) {
        // Check if it's an API error with specific message
        if (error.message.includes('maximum number of Dev mode deployments')) {
          errorMessage = error.message;
        } else if (error.message.includes('API Error:')) {
          // Extract the message after "API Error: STATUS -"
          const match = error.message.match(/API Error: \d+ [A-Z]+ - (.+)/);
          errorMessage = match ? match[1] : error.message;
        } else {
          errorMessage = error.message;
        }
      }

      setRailwayDeployError(errorMessage);

      // Don't check status if deployment didn't start
      // (this prevents 404 error from getDeploymentStatus)
    } finally {
      setIsDeployingRailway(false);
    }
  };

  // Polling is now handled in useProjectLifecycle hook

  const renderStatusMessage = () => {
    if (isImportMode) {
      if (railwayDeploymentStatus === 'BUILDING') {
        return 'Deploying...';
      }
      if (railwayDeploymentStatus === 'FAILED') {
        return railwayMessage || 'Deployment failed. Check logs for details.';
      }
      if (railwayDeploymentStatus === 'SUCCESS') {
        return 'Your app is live.';
      }
      return railwayMessage || 'Deploy to push the current build to production.';
    }

    if (state === 'deploying') {
      return 'Deployment is running. We will flip to Live once it completes.';
    }
    if (state === 'removing') {
      return 'Removing deployment...';
    }
    if (state === 'live') {
      return 'Your site is live on production.';
    }
    if (state === 'error') {
      return displayErrorMessage;
    }
    return 'Publish to push the current build to production.';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -8 }}
          transition={{ duration: 0.15 }}
          ref={panelRef}
          className="absolute right-0 mt-3 w-80 rounded-2xl border border-primary bg-primary shadow-xl z-40"
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary">Publish</h2>
              <span
                className={clsx(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  statusBadgeStyles[state],
                )}
              >
                {statusLabel[state]}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-tertiary hover:text-secondary rounded-lg transition-colors"
              aria-label="Close publish popover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5">
            <p className="mt-2 text-xs text-tertiary">Make your product live</p>

            <div className="mt-4 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-tertiary">
                      Website Address
                    </span>
                    {((isImportMode && railwayDeploymentStatus === 'SUCCESS' && railwayUrl) || (!isImportMode && state === 'live')) && (
                      <span key="deployed-status" className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                        Deployed
                      </span>
                    )}
                  </div>
                  {!isImportMode && !isEditing && state !== 'deploying' && (
                    <button
                      key="edit-button"
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="py-1 px-3 rounded-lg text-xs transition-colors hover:bg-interactive-hover text-primary"
                      style={{ fontWeight: '500' }}
                    >
                      Edit
                    </button>
                  )}
                  {!isImportMode && isEditing && (
                    <button
                      key="done-button"
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="py-1 px-3 rounded-lg text-xs transition-colors hover:bg-interactive-hover text-primary"
                      style={{ fontWeight: '500' }}
                    >
                      Done
                    </button>
                  )}
                </div>

                {isImportMode ? (
                  <div className="group flex items-center gap-2">
                    {railwayUrl && railwayDeploymentStatus !== 'FAILED' && !railwayMessage?.toLowerCase().includes('failed') ? (
                      <a
                        href={railwayUrl.startsWith('http') ? railwayUrl : `https://${railwayUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-2 rounded-lg border border-primary px-3 py-2 transition-all hover:border-secondary min-w-0"
                      >
                        <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                        <span className="text-sm text-primary underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 group-hover:decoration-gray-500 dark:group-hover:decoration-gray-400 transition-colors min-w-0 truncate">
                          {railwayUrl.replace(/^https?:\/\//, '')}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-tertiary flex-shrink-0 ml-auto group-hover:text-secondary transition-colors" />
                      </a>
                    ) : (
                      <div className="flex-1 flex items-center gap-2 rounded-lg border border-primary bg-secondary px-3 py-2 min-w-0">
                        <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                        <span className="text-sm text-tertiary">
                          Not deployed yet
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={subdomainName}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase();
                              onSubdomainChange(value);
                            }}
                            placeholder="my-awesome-app"
                            className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border outline-none transition-all"
                            style={{
                              borderColor: isValidSubdomain && isAvailable
                                ? '#10b981'
                                : isValidSubdomain && isAvailable === false
                                ? '#ef4444'
                                : 'var(--border-primary)',
                              backgroundColor: isValidSubdomain && isAvailable
                                ? 'rgb(240 253 244)'
                                : isValidSubdomain && isAvailable === false
                                ? 'rgb(254 242 242)'
                                : 'var(--bg-secondary)',
                              color: isValidSubdomain && isAvailable
                                ? '#166534'
                                : isValidSubdomain && isAvailable === false
                                ? '#991b1b'
                                : 'var(--text-primary)',
                            }}
                            onFocus={(e) => {
                              if (!isValidSubdomain || isAvailable === null) {
                                e.target.style.borderColor = '#1a1a1a';
                              }
                            }}
                            onBlur={(e) => {
                              if (!isValidSubdomain || isAvailable === null) {
                                e.target.style.borderColor = 'var(--border-primary)';
                              }
                            }}
                            disabled={state === 'deploying'}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isCheckingAvailability ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : isValidSubdomain && isAvailable ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : isValidSubdomain && isAvailable === false ? (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs px-1">
                          <span className="text-tertiary">
                            {subdomainName}.{domainSuffix}
                          </span>
                          {isValidSubdomain && isAvailable === false && (
                            <span className="text-red-600 dark:text-red-400 font-medium">Already taken</span>
                          )}
                          {!isValidSubdomain && subdomainName && (
                            <span className="text-amber-600 dark:text-amber-400">Invalid format</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="group">
                        {state === 'live' ? (
                          <a
                            href={`https://${websiteAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-primary px-3 py-2 transition-all hover:border-secondary min-w-0"
                          >
                            <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                            <span className="text-sm text-primary underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 group-hover:decoration-gray-500 dark:group-hover:decoration-gray-400 transition-colors min-w-0 flex items-baseline">
                              <span className="truncate">{subdomainName}</span>
                              <span className="flex-shrink-0">.{domainSuffix}</span>
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-tertiary flex-shrink-0 ml-auto group-hover:text-secondary transition-colors" />
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary px-3 py-2 min-w-0">
                            <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                            <span className="text-sm text-tertiary min-w-0 flex items-baseline">
                              <span className="truncate">{subdomainName}</span>
                              <span className="flex-shrink-0">.{domainSuffix}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {state === 'error' && !isImportMode && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {shouldShowErrorIcon && <ShieldAlert className="h-4 w-4" />}
                  <span>{displayErrorMessage}</span>
                </div>
              )}

              {isImportMode && (railwayMessage || railwayDeployError) && (
                <div>
                  <div
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                      railwayDeployError || railwayDeploymentStatus === 'FAILED' || railwayMessage?.toLowerCase().includes('failed')
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : railwayDeploymentStatus === 'SUCCESS'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
                    )}
                  >
                    {(railwayDeployError || railwayDeploymentStatus === 'FAILED' || railwayMessage?.toLowerCase().includes('failed')) && <ShieldAlert className="h-4 w-4" />}
                    {railwayDeploymentStatus === 'BUILDING' && !railwayDeployError && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{railwayDeployError || railwayMessage}</span>
                  </div>

                  {(railwayDeploymentStatus === 'FAILED' || railwayMessage?.toLowerCase().includes('failed')) && railwayErrorLogs && onSendPromptToAgent && !fixWithAiClicked && (
                    <button
                      onClick={() => {
                        const errorPrompt = `Fix deployment error:\n\n${railwayErrorLogs}`;
                        onSendPromptToAgent(errorPrompt);
                        setFixWithAiClicked(true);
                        onClose();
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Fix with AI
                    </button>
                  )}
                </div>
              )}

              {!isImportMode && customDomains.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-tertiary">
                      Custom Domains
                    </span>
                    {customDomains.some((d) => d.status === 'active' && d.isDeployed) && (
                      <span key="deployed-badge" className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                        Deployed
                      </span>
                    )}
                    {customDomains.some((d) => d.status === 'active' && !d.isDeployed) && !customDomains.some((d) => d.status === 'active' && d.isDeployed) && (
                      <span key="verified-badge" className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {customDomains.map((domain, index) => (
                      <div key={`custom-domain-${index}-${domain.id || domain.domain || Math.random()}`} className="group">
                        {domain.status === 'active' && domain.isDeployed ? (
                          <a
                            href={domain.domain ? `https://${domain.domain}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-primary px-3 py-2 transition-all hover:border-secondary"
                            onClick={(e) => {
                              if (!domain.domain) {
                                e.preventDefault();
                                if (process.env.NODE_ENV === 'development') {
                                  console.error('Domain value is empty:', domain);
                                }
                              }
                            }}
                          >
                            <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                            <span className="text-sm text-primary underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 group-hover:decoration-gray-500 dark:group-hover:decoration-gray-400 transition-colors truncate">
                              {domain.domain || 'Unknown domain'}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-tertiary flex-shrink-0 ml-auto group-hover:text-secondary transition-colors" />
                          </a>
                        ) : domain.status === 'active' ? (
                          <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary px-3 py-2">
                            <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                            <span className="text-sm text-tertiary truncate">
                              {domain.domain || 'Unknown domain'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary px-3 py-2">
                            <Globe className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
                            <span className="text-sm text-tertiary truncate">
                              {domain.domain || 'Unknown domain'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto flex-shrink-0 ${
                              domain.status === 'pending'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {domain.status === 'pending' ? 'Pending' : 'Failed'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-primary">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-tertiary">
                    Website info
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWebsiteInfoModalOpen(true)}
                    className="py-1 px-3 rounded-lg text-xs transition-colors hover:bg-interactive-hover text-primary"
                    style={{ fontWeight: '500' }}
                  >
                    Edit
                  </button>
                </div>
                <p className="mt-3 text-xs text-tertiary leading-5">
                  {renderStatusMessage()}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <div className="relative" ref={unpublishSectionRef}>
                <button
                  type="button"
                  onClick={() => setIsConfirmingUnpublish((prev) => !prev)}
                  disabled={(isImportMode ? (!railwayUrl || isUnpublishingRailway) : (!canUnpublish || state === 'deploying' || state === 'removing'))}
                  className={clsx(
                    'inline-flex items-center justify-center rounded-xl border border-primary px-4 py-2.5 text-sm transition-colors whitespace-nowrap text-secondary',
                    (isImportMode ? (railwayUrl && !isUnpublishingRailway) : canUnpublish) && state !== 'deploying' && state !== 'removing'
                      ? 'hover:bg-interactive-hover'
                      : 'cursor-not-allowed opacity-50',
                  )}
                  style={{ fontWeight: '500' }}
                >
                  Unpublish
                </button>
                {isConfirmingUnpublish && (
                  <div className="absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-64 -translate-x-1/2 rounded-3xl border border-red-200/70 dark:border-red-800/70 bg-primary p-4 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                    <span className="pointer-events-none absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-red-200/70 dark:border-red-800/70 bg-primary" />
                    <div className="text-xs leading-5 text-secondary">
                      {selectedDeployTarget.type === 'custom'
                        ? `This will unpublish from ${customDomains.find((d) => d.id === selectedDeployTarget.domainId)?.domain || 'this custom domain'}. You can publish again anytime.`
                        : isImportMode
                        ? 'Your Railway deployment will be taken offline immediately. You can deploy again anytime.'
                        : 'Your website address will go offline immediately. You can publish again anytime.'}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-primary bg-primary px-3 py-1.5 font-medium text-secondary transition-colors hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleCancelUnpublishConfirm}
                        disabled={isImportMode ? isUnpublishingRailway : state === 'removing'}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-full bg-red-500 dark:bg-red-600 px-3 py-1.5 font-semibold text-white shadow-[0_12px_30px_rgba(239,68,68,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-red-500 dark:hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 inline-flex items-center justify-center gap-2"
                        onClick={handleConfirmUnpublish}
                        disabled={isImportMode ? isUnpublishingRailway : state === 'removing'}
                      >
                        {(isImportMode ? isUnpublishingRailway : state === 'removing') && <Loader2 className="h-3 w-3 animate-spin" />}
                        Unpublish
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => (isImportMode ? handleRailwayDeploy() : onUpdateClick(selectedDeployTarget))}
                disabled={
                  isImportMode
                    ? isDeployingRailway || railwayDeploymentStatus === 'BUILDING' || railwayDeploymentStatus === 'PENDING'
                    : isActionDisabled
                }
                className={clsx(
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm text-white transition-colors bg-interactive-primary',
                  isImportMode
                    ? isDeployingRailway || railwayDeploymentStatus === 'BUILDING' || railwayDeploymentStatus === 'PENDING'
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                    : isActionDisabled
                    ? 'cursor-not-allowed opacity-50'
                    : '',
                )}
                style={{ fontWeight: '600' }}
              >
                {(isImportMode && (isDeployingRailway || railwayDeploymentStatus === 'PENDING' || railwayDeploymentStatus === 'BUILDING')) || (!isImportMode && state === 'deploying') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isImportMode ? (railwayUrl ? 'Redeploy' : 'Deploy') : state === 'live' ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>

          <WebsiteInfoModal
            isOpen={isWebsiteInfoModalOpen}
            onClose={() => setIsWebsiteInfoModalOpen(false)}
            projectId={projectId}
          />
        </motion.div>
      )}
      <FullUpgradeModal
        isOpen={showFullUpgradeModal}
        onClose={() => setShowFullUpgradeModal(false)}
        projectId={projectId}
        featureName="Dev mode deployment"
      />
    </AnimatePresence>
  );
}

export default PublishModal;
