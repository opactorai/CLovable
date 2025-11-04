'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { UserPlan } from '@/types/user';
import {
  trackProPlanModalViewed,
  trackProPlanModalDismissed,
  trackProPlanUpgraded,
  trackBuildSettingToggled,
} from '@/lib/analytics';

interface CustomTabProps {
  projectId: string;
  userPlan: UserPlan;
}

interface CustomDomain {
  id: string;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  verifiedIp?: string;
  lastVerifiedAt?: string;
  verificationError?: string;
  createdAt: string;
  sslStatus?: string;
  cloudflareCustomHostnameId?: string;
  dnsInstructions?: {
    records: Array<{
      type: string;
      host: string;
      value: string;
      ttl: number;
      description?: string;
    }>;
    instructions: string[];
    provider?: {
      name: string;
      nameservers: string[];
      setupGuideUrl?: string;
      notes?: string;
    };
  };
}

interface Project {
  id: string;
  name: string;
  badgeEnabled: boolean;
  isPublic: boolean;
}

export default function CustomTab({ projectId, userPlan }: CustomTabProps) {
  const { user, refreshAuth } = useAuth();
  const [removeBadge, setRemoveBadge] = useState(false); // Toggle ON = remove badge
  const [project, setProject] = useState<Project | null>(null);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showDns, setShowDns] = useState(true);
  const [showProvider, setShowProvider] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] =
    useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [modalTriggerFeature, setModalTriggerFeature] = useState<string>('');

  // Use actual user plan from auth hook, fallback to prop
  const currentUserPlan = user?.plan ?? userPlan;
  const isFreePlan = currentUserPlan === 'free';

  useEffect(() => {
    void loadProject();
    if (isFreePlan) {
      return;
    }
    void loadDomains();
  }, [projectId, isFreePlan]);

  const loadProject = async () => {
    try {
      const data = await apiClient.getProject(projectId);
      setProject(data);
      // Set removeBadge based on badgeEnabled (inverted logic)
      setRemoveBadge(!data.badgeEnabled);
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const loadDomains = async () => {
    try {
      const data = await apiClient.getProjectDomains(projectId);
      setDomains(data ?? []);
    } catch (err: any) {
      console.error('Failed to load domains:', err);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.addDomain(newDomain.trim(), projectId);
      await loadDomains();
      setShowDns(true);
      setNewDomain('');

      // Track custom domain added
      trackBuildSettingToggled('custom_domain', true, true);
    } catch (err: any) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(true);
    setError(null);

    try {
      const result = await apiClient.verifyDomain(domainId);
      await loadDomains();

      // Only show error if verification actually failed (not just pending)
      if (!result.verified && result.status === 'failed') {
        setError(result.message);
      }
      // If still pending, don't show error - it's just waiting for DNS propagation
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to remove this domain?')) {
      return;
    }

    try {
      await apiClient.removeDomain(domainId);
      await loadDomains();
      setShowDns(true);
    } catch (err: any) {
      setError(err.message || 'Failed to remove domain');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const currentDomain = domains[0];

  const handleCloseUpgradeModal = () => {
    // Track modal dismissal
    if (modalTriggerFeature) {
      trackProPlanModalDismissed(modalTriggerFeature, 'custom_settings');
    }
    setShowUpgradeModal(false);
    setModalTriggerFeature('');
  };

  const handleUpgradeToPro = async () => {
    setUpgradeError(null);
    setIsRedirectingToCheckout(true);

    // Track upgrade click
    trackProPlanUpgraded('custom_settings');

    try {
      const response = await apiClient.createSubscriptionCheckout({
        plan: 'pro',
        projectId
      });

      // Check if this was an upgrade (not a new checkout)
      if ('upgraded' in response && response.upgraded) {
        // Subscription upgraded successfully - reload to refresh user data
        window.location.reload();
        return;
      }

      // New subscription - redirect to checkout
      if ('checkoutUrl' in response && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      throw new Error('Checkout URL was not provided.');
    } catch (err: any) {
      console.error('Failed to create Stripe checkout session:', err);
      setUpgradeError(
        err?.message || 'We could not open the checkout page. Please try again in a moment.',
      );
      setIsRedirectingToCheckout(false);
    }
  };

  const handleToggleBadge = async () => {
    if (isFreePlan) {
      setModalTriggerFeature('remove_badge');
      setShowUpgradeModal(true);
      trackProPlanModalViewed('remove_badge', 'custom_settings');
      return;
    }

    const newRemoveBadgeState = !removeBadge;
    setRemoveBadge(newRemoveBadgeState);

    // Track setting toggle
    trackBuildSettingToggled('badge_enabled', !newRemoveBadgeState, false);

    // Update backend: removeBadge ON means badgeEnabled = false
    const badgeEnabled = !newRemoveBadgeState;

    try {
      await apiClient.updateProject(projectId, { badgeEnabled });
    } catch (err) {
      // Revert on error
      setRemoveBadge(!newRemoveBadgeState);
      console.error('Failed to update badge setting:', err);
    }
  };

  return (
    <>
      <div className="space-y-4 max-w-3xl">
        {/* Badge Section */}
        <section
          className="rounded-2xl p-6 border border-primary"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-secondary" />
              <h4
                className="text-primary"
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  letterSpacing: '-0.3px',
                }}
              >
                Remove Clink Badge
              </h4>
              {isFreePlan && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-poppins flex items-center bg-interactive-primary dark:bg-white text-white dark:text-gray-900"
                  style={{
                    fontWeight: '700',
                  }}
                >
                  Pro
                </span>
              )}
            </div>
            <button
              onClick={handleToggleBadge}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                removeBadge ? 'bg-interactive-primary' : 'bg-gray-300 dark:bg-elevated'
              } ${isFreePlan ? 'opacity-50 cursor-pointer' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${
                  removeBadge ? 'translate-x-6 bg-white dark:bg-secondary' : 'translate-x-1 bg-white dark:bg-gray-300'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-secondary">
            Hide the "Made in Clink" badge from your published project.
          </p>
        </section>

        {/* Custom Domain Section */}
        <section
          className="rounded-2xl p-6 space-y-4 border border-primary"
        >
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-5 w-5 text-secondary" />
            <h4
              className="text-primary"
              style={{
                fontSize: '16px',
                fontWeight: '600',
                letterSpacing: '-0.3px',
              }}
            >
              Custom Domain
            </h4>
            {isFreePlan && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-poppins flex items-center bg-interactive-primary dark:bg-white text-white dark:text-gray-900"
                style={{
                  fontWeight: '700',
                }}
              >
                Pro
              </span>
            )}
          </div>
          <p className="text-sm text-secondary">
            Connect your own domain.
          </p>

          {!currentDomain && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="clink.new"
                  className="flex-1 rounded-xl border border-primary px-4 py-3 text-sm outline-none transition-all text-primary dark:text-primary bg-secondary"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isFreePlan) {
                        setModalTriggerFeature('custom_domain');
                        setShowUpgradeModal(true);
                        trackProPlanModalViewed('custom_domain', 'custom_settings');
                      } else {
                        handleAddDomain();
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (isFreePlan) {
                      setModalTriggerFeature('custom_domain');
                      setShowUpgradeModal(true);
                      trackProPlanModalViewed('custom_domain', 'custom_settings');
                    } else {
                      handleAddDomain();
                    }
                  }}
                  disabled={loading || (!isFreePlan && !newDomain.trim())}
                  className="px-5 py-3 text-sm rounded-xl disabled:opacity-30 transition-all bg-interactive-primary text-white dark:text-gray-900 dark:bg-foreground"
                  style={{
                    fontWeight: '500',
                  }}
                >
                  {loading ? 'Adding…' : 'Add Domain'}
                </button>
              </div>
              {error && !isFreePlan && (
                <div
                  className="flex items-start gap-2 rounded-xl border p-3"
                  style={{
                    backgroundColor: '#fef2f2',
                    borderColor: '#fecaca',
                  }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: '#dc2626' }}
                  />
                  <p className="text-sm" style={{ color: '#dc2626' }}>
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}

          {currentDomain && !isFreePlan && (
            <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-4">
                <p
                  className="text-primary"
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {currentDomain.domain}
                </p>
                <div className="flex items-center gap-2">
                  {currentDomain.status === 'active' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs" style={{ fontWeight: '500' }}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  )}
                  {currentDomain.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs" style={{ fontWeight: '500' }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Pending verification
                    </span>
                  )}
                  {currentDomain.status === 'failed' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs" style={{ fontWeight: '500' }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 sm:items-center" onClick={(event) => event.stopPropagation()}>
                {currentDomain.status !== 'active' && (
                  <button
                    onClick={() => handleVerify(currentDomain.id)}
                    disabled={verifying}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap disabled:opacity-50 transition-all border border-primary text-primary hover:bg-interactive-hover"
                    style={{
                      fontWeight: '500',
                    }}
                  >
                    <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                    {verifying ? 'Verifying…' : 'Verify again'}
                  </button>
                )}
                <button
                  onClick={() => handleRemoveDomain(currentDomain.id)}
                  className="px-4 py-2.5 text-sm rounded-xl whitespace-nowrap transition-all text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  style={{
                    fontWeight: '500',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            {currentDomain.status === 'pending' && !error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-primary dark:border-primary bg-secondary dark:bg-secondary">
                <AlertCircle className="w-4 h-4 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-primary dark:text-primary">Domain verification in progress.</p>
              </div>
            )}

            {error && currentDomain.status !== 'active' && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {currentDomain.status !== 'active' && currentDomain.dnsInstructions && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowDns((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-primary px-4 py-3.5 text-left transition-all hover:bg-interactive-hover"
                >
                  <span>DNS Setup Instructions</span>
                  {showDns ? (
                    <ChevronUp className="w-4 h-4 text-secondary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-secondary" />
                  )}
                </button>
                {showDns && (
                  <div className="space-y-4">
                    {/* DNS Provider Detection */}
                    {currentDomain.dnsInstructions.provider && (
                      <div className="rounded-lg border border-primary dark:border-primary bg-secondary dark:bg-secondary">
                        <button
                          onClick={() => setShowProvider((prev) => !prev)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-elevated dark:hover:bg-elevated rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-primary dark:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm font-medium text-primary dark:text-primary">
                              DNS Provider Detected: <span className="font-semibold text-primary dark:text-primary">{currentDomain.dnsInstructions.provider.name}</span>
                            </span>
                          </div>
                          {showProvider ? (
                            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </button>
                        {showProvider && (
                          <div className="px-4 pb-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3 mt-0">
                            {currentDomain.dnsInstructions.provider.notes && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {currentDomain.dnsInstructions.provider.notes}
                              </p>
                            )}
                            {currentDomain.dnsInstructions.provider.setupGuideUrl && (
                              <a
                                href={currentDomain.dnsInstructions.provider.setupGuideUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
                              >
                                Open {currentDomain.dnsInstructions.provider.name} Dashboard
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                            {currentDomain.dnsInstructions.provider.nameservers.length > 0 && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                <p className="font-medium mb-1">Nameservers ({currentDomain.dnsInstructions.provider.nameservers.length})</p>
                                <ul className="space-y-0.5 pl-4 font-mono text-[10px] text-gray-500 dark:text-gray-500">
                                  {currentDomain.dnsInstructions.provider.nameservers.map((ns, idx) => (
                                    <li key={idx}>• {ns}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step-by-step instructions */}
                    {currentDomain.dnsInstructions.instructions && (
                      <div className="rounded-lg border border-primary p-4 space-y-2">
                        <p className="text-sm font-medium text-primary mb-3">Follow these steps:</p>
                        <ol className="space-y-2">
                          {currentDomain.dnsInstructions.instructions.map((instruction, index) => (
                            <li key={index} className="text-sm text-secondary flex gap-2">
                              <span className="text-primary dark:text-primary">{instruction}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* DNS Records */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-primary">DNS Records:</p>
                      {currentDomain.dnsInstructions.records.map((record, index) => (
                        <div
                          key={`${record.type}-${record.host}-${index}`}
                          className="rounded-lg border border-primary p-4 space-y-3"
                        >
                          {record.description && (
                            <p className="text-xs text-tertiary">{record.description}</p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <p className="text-xs font-medium text-tertiary mb-1">
                                Type
                              </p>
                              <p className="font-mono text-sm text-primary">
                                {record.type}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-tertiary mb-1">
                                Host
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm text-primary break-all">
                                  {record.host}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(record.host, `host-${index}`)}
                                  className="p-1 rounded transition-colors hover:bg-interactive-hover flex-shrink-0"
                                >
                                  {copiedField === `host-${index}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-tertiary" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-tertiary mb-1">
                                Value
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm text-primary break-all flex-1">
                                  {record.value}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(record.value, `value-${index}`)}
                                  className="p-1 rounded transition-colors hover:bg-interactive-hover flex-shrink-0"
                                >
                                  {copiedField === `value-${index}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-tertiary" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                      <AlertCircle className="w-4 h-4 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-primary dark:text-primary">
                        DNS propagation and SSL certificate issuance can take up to 24 hours. Click "Verify again" to check the status.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </section>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseUpgradeModal}
        >
          <div
            className="bg-secondary rounded-3xl w-full max-w-md overflow-hidden relative border border-primary"
            style={{
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseUpgradeModal}
              className="absolute top-6 right-6 text-tertiary hover:text-secondary transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-8 pt-8 pb-3">
              <div className="w-16 h-16 mb-4 flex items-center justify-center">
                <Image
                  src="/assets/logo_svg/clink_logo_black.svg"
                  alt="Clink Logo"
                  width={64}
                  height={64}
                  className="dark:hidden"
                />
                <Image
                  src="/assets/logo_svg/clink_logo_white.svg"
                  alt="Clink Logo"
                  width={64}
                  height={64}
                  className="hidden dark:block"
                />
              </div>
              <h2
                className="mb-2 text-primary"
                style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  letterSpacing: '-0.5px',
                }}
              >
                Upgrade to Pro
              </h2>
              <p
                className="mb-0 text-secondary"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              >
                Unlock custom domains and badge control
              </p>
            </div>

            {/* Upgrade Fee */}
            <div className="px-8 pb-4">
              <div
                className="rounded-2xl p-4 border border-primary"
              >
                <p
                  className="text-xs mb-1 text-primary"
                  style={{
                    fontWeight: '500',
                  }}
                >
                  Upgrade Fee
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-primary"
                    style={{
                      fontSize: '32px',
                      fontWeight: '600',
                      letterSpacing: '-1px',
                    }}
                  >
                    $5
                  </span>
                  <span
                    className="text-secondary"
                    style={{
                      fontSize: '14px',
                    }}
                  >
                    per month
                  </span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="px-8 pb-4">
              <div
                className="rounded-2xl p-4 bg-secondary"
              >
                <p
                  className="text-xs mb-3 text-primary"
                  style={{
                    fontWeight: '600',
                  }}
                >
                  You will unlock:
                </p>
                <ul className="space-y-2 text-sm text-primary">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span style={{ fontWeight: '400' }}>Custom domains</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span style={{ fontWeight: '400' }}>Hide Clink badge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span style={{ fontWeight: '400' }}>Priority support</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="px-8 pb-8 flex gap-3">
              <button
                onClick={handleCloseUpgradeModal}
                className="flex-1 py-3 rounded-xl text-sm transition-all border border-primary text-primary"
                style={{
                  fontWeight: '600',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpgradeToPro}
                disabled={isRedirectingToCheckout}
                className="flex-1 py-3 rounded-xl text-sm disabled:opacity-50 transition-all bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                style={{
                  fontWeight: '600',
                }}
              >
                {isRedirectingToCheckout ? 'Opening checkout…' : 'Upgrade'}
              </button>
            </div>

            {upgradeError && (
              <div className="px-8 pb-6">
                <div
                  className="flex items-start gap-2 rounded-xl border p-3"
                  style={{
                    backgroundColor: '#fef2f2',
                    borderColor: '#fecaca',
                  }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: '#dc2626' }}
                  />
                  <p className="text-sm" style={{ color: '#dc2626' }}>
                    {upgradeError}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
