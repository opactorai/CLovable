'use client';

import { AlertCircle, Check } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import apiClient from '@/lib/api-client';

interface FullUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  featureName?: string;
}

export default function FullUpgradeModal({
  isOpen,
  onClose,
  projectId,
  featureName = 'Railway deployment',
}: FullUpgradeModalProps) {
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpgradeToFull = async () => {
    setUpgradeError(null);
    setIsRedirectingToCheckout(true);

    try {
      const response = await apiClient.createSubscriptionCheckout({
        plan: 'full',
        projectId,
      });

      // Check if this was an upgrade (not a new checkout)
      if ('upgraded' in response && response.upgraded) {
        setUpgradeSuccess(true);
        setIsRedirectingToCheckout(false);

        // Show success message briefly, then reload to refresh user data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
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
          onClick={onClose}
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
            Upgrade to FULL
          </h2>
          <p
            className="mb-0 text-secondary"
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          >
            Unlock Dev mode deployments and all Pro features
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
                $25
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
                <span style={{ fontWeight: '400' }}>Dev mode deployments (up to 10 projects)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                <span style={{ fontWeight: '400' }}>All Pro features (custom domains, badge control)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                <span style={{ fontWeight: '400' }}>Production-ready deployments</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                <span style={{ fontWeight: '400' }}>Priority support</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Success Message */}
        {upgradeSuccess && (
          <div className="px-8 pb-4">
            <div
              className="flex items-start gap-2 rounded-xl border p-3"
              style={{
                backgroundColor: '#f0fdf4',
                borderColor: '#bbf7d0',
              }}
            >
              <Check
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                style={{ color: '#16a34a' }}
              />
              <p className="text-sm" style={{ color: '#16a34a' }}>
                Successfully upgraded to FULL plan! Refreshing...
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={onClose}
            disabled={upgradeSuccess}
            className="flex-1 py-3 rounded-xl text-sm transition-all border border-primary text-primary disabled:opacity-50"
            style={{
              fontWeight: '600',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpgradeToFull}
            disabled={isRedirectingToCheckout || upgradeSuccess}
            className="flex-1 py-3 rounded-xl text-sm disabled:opacity-50 transition-all bg-gray-900 dark:bg-white text-white dark:text-gray-900"
            style={{
              fontWeight: '600',
            }}
          >
            {upgradeSuccess ? 'Upgraded!' : isRedirectingToCheckout ? 'Processing…' : 'Upgrade'}
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
  );
}
