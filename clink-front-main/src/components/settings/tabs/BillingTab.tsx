'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api-client';
import { CreditCard, Download, Calendar, DollarSign, AlertCircle, Check } from 'lucide-react';
import Image from 'next/image';
import type { UserPlan } from '@/types/user';
import { clientLogger } from '@/lib/client-logger';

interface Invoice {
  id: string;
  amount_paid: number;
  created: number;
  currency: string;
  status: string;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  number?: string;
}

interface Subscription {
  id: string;
  plan: UserPlan;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

const PLAN_DETAILS: Record<UserPlan, { name: string; price: string; features: string[] }> = {
  free: {
    name: 'Free',
    price: '$0',
    features: ['Basic features', 'Community support'],
  },
  pro: {
    name: 'Pro',
    price: '$5',
    features: ['Custom domains', 'Hide Clink badge', 'Private projects', 'Priority support'],
  },
  full: {
    name: 'Full',
    price: '$25',
    features: ['Everything in Pro', 'Dev mode deployments (up to 10)', 'Unlimited projects', 'Advanced analytics', '24/7 support'],
  },
};

interface BillingTabProps {
  projectId?: string;
}

export default function BillingTab({ projectId }: BillingTabProps) {
  const { user, refreshAuth } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = user?.plan ?? 'free';
  const planDetails = PLAN_DETAILS[currentPlan];

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, subRes] = await Promise.all([
        apiClient.getInvoices(),
        apiClient.getCurrentSubscription(),
      ]);
      setInvoices(invoicesRes.data || []);
      setSubscription(subRes);
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: 'pro' | 'full') => {
    setShowUpgradeModal(true);
  };

  const handleUpgradeToPro = async () => {
    setUpgradeError(null);
    setIsRedirectingToCheckout(true);
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

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setError(null);
    try {
      // Build a clean, valid URL
      const returnUrl = `${window.location.origin}${window.location.pathname}`;

      clientLogger.debug('Sending returnUrl:', returnUrl);

      const response = await apiClient.createBillingPortalSession({
        returnUrl,
      });

      if (!response?.url) {
        throw new Error('No portal URL returned');
      }

      window.location.href = response.url;
    } catch (err: any) {
      console.error('Failed to open billing portal:', err);

      // Extract error message from API response
      let errorMessage = 'Failed to open billing portal. Please try again.';
      if (err?.message?.includes('returnUrl must be a URL address')) {
        errorMessage = 'Invalid return URL. Please try again or contact support.';
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setCancelLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Show loading state while user data is being fetched
  if (!user || loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <section className="bg-primary rounded-2xl p-6 border border-primary">
          <div className="animate-pulse">
            <div className="h-6 bg-secondary rounded w-32 mb-4"></div>
            <div className="h-10 bg-secondary rounded w-24 mb-2"></div>
            <div className="h-4 bg-secondary rounded w-40 mb-6"></div>
            <div className="space-y-2 mb-6">
              <div className="h-4 bg-secondary rounded w-full"></div>
              <div className="h-4 bg-secondary rounded w-full"></div>
              <div className="h-4 bg-secondary rounded w-full"></div>
            </div>
            <div className="h-12 bg-secondary rounded w-full"></div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Current Plan Section - Only show if Pro or above */}
      {currentPlan !== 'free' && (
        <section className="bg-primary rounded-2xl p-6 border border-primary">
          <h3
            className="mb-4 text-primary"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '-0.3px',
            }}
          >
            Current Plan
          </h3>

          <div className="flex items-baseline gap-2 mb-1">
            <span
              className="text-primary"
              style={{
                fontSize: '32px',
                fontWeight: '600',
                letterSpacing: '-1px',
              }}
            >
              {planDetails.price}
            </span>
            <span className="text-secondary" style={{ fontSize: '14px' }}>
              / month
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-secondary">
              {planDetails.name} Plan
            </p>
            {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
              <p className="text-xs mt-1" style={{ color: '#dc2626', fontWeight: '500' }}>
                Ending on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>

          <ul className="space-y-2 mb-6">
            {planDetails.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-secondary">
                <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          {currentPlan === 'pro' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full py-2 text-xs transition-all hover:underline"
                style={{
                  color: '#9ca3af',
                  fontWeight: '400',
                }}
              >
                Cancel subscription
              </button>
            </div>
          )}

          {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
            <div
              className="mt-4 p-3 rounded-lg flex items-start gap-2"
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
                  Subscription Ending
                </p>
                <p className="text-xs mt-1" style={{ color: '#dc2626' }}>
                  Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Upgrade to Pro Section - Only show if Free plan */}
      {currentPlan === 'free' && (
        <section className="bg-primary rounded-2xl p-6 border border-primary">
          <h3
            className="mb-4 text-primary"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '-0.3px',
            }}
          >
            Upgrade to Pro
          </h3>

          <div className="flex items-baseline gap-2 mb-1">
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
            <span className="text-secondary" style={{ fontSize: '14px' }}>
              / month
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-secondary">
              Pro Plan
            </p>
          </div>

          <ul className="space-y-2 mb-6">
            {PLAN_DETAILS.pro.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-secondary">
                <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleUpgrade('pro')}
            className="w-full py-3 rounded-xl text-sm transition-all text-white hover:opacity-90"
            style={{
              fontWeight: '600',
              backgroundColor: '#1a1a1a',
            }}
          >
            Upgrade to Pro - $5/month
          </button>
        </section>
      )}

      {/* Billing History Section */}
      {invoices.length > 0 && (
        <section
          className="bg-primary rounded-2xl p-6 border border-primary"
        >
          <h3
            className="mb-4 text-primary"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '-0.3px',
            }}
          >
            Billing History
          </h3>

          {loading ? (
            <div className="text-center py-8 text-secondary">
              Loading invoices...
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary border border-primary"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-primary"
                    >
                      <CreditCard className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {invoice.number || `Invoice ${invoice.id.slice(-8)}`}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs flex items-center gap-1 text-secondary">
                          <Calendar className="w-3 h-3" />
                          {formatDate(invoice.created)}
                        </p>
                        <p className="text-xs flex items-center gap-1 text-secondary">
                          <DollarSign className="w-3 h-3" />
                          {formatAmount(invoice.amount_paid, invoice.currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: invoice.status === 'paid' ? '#dcfce7' : '#fef2f2',
                        color: invoice.status === 'paid' ? '#16a34a' : '#dc2626',
                        fontWeight: '500',
                      }}
                    >
                      {invoice.status}
                    </span>
                    {invoice.invoice_pdf && (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-interactive-hover transition-colors text-secondary"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Cancel Modal */}
      {showCancelModal && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-primary rounded-3xl w-full max-w-md p-8 border border-primary"
            style={{
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-3 text-primary"
              style={{
                fontSize: '24px',
                fontWeight: '600',
                letterSpacing: '-0.5px',
              }}
            >
              Cancel Subscription?
            </h3>
            <p className="text-sm mb-2 text-secondary">
              If you cancel, the following will happen to your projects:
            </p>
            <ul className="text-sm mb-6 space-y-1 ml-4 text-secondary">
              <li>• Custom domain connections will be disconnected</li>
              <li>• Clink badge will be shown again</li>
              <li>• Private projects will become public</li>
              <li>• Priority support will no longer be available</li>
            </ul>
            <p className="text-xs mb-6 text-tertiary">
              You'll be redirected to manage your subscription settings.
            </p>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
              >
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setError(null);
                }}
                className="flex-1 py-3 rounded-xl text-sm transition-all border border-primary text-primary"
                style={{
                  fontWeight: '600',
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="flex-1 py-3 rounded-xl text-sm transition-all bg-red-600 dark:bg-red-700 text-white"
                style={{
                  fontWeight: '600',
                }}
              >
                {cancelLoading ? 'Loading...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowUpgradeModal(false)}
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
              onClick={() => setShowUpgradeModal(false)}
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
                    <span style={{ fontWeight: '400' }}>Private projects</span>
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
                onClick={() => setShowUpgradeModal(false)}
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
        </div>,
        document.body
      )}
    </div>
  );
}
