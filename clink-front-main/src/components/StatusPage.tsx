'use client';

import Image from 'next/image';
import { ReactNode } from 'react';

type StatusType = 'success' | 'error' | 'loading';

interface StatusPageProps {
  type: StatusType;
  title: string;
  message: string;
  additionalMessage?: string;
  button?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export default function StatusPage({
  type,
  title,
  message,
  additionalMessage,
  button,
  children,
}: StatusPageProps) {
  const renderIcon = () => {
    if (type === 'loading') {
      return (
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="relative h-16 w-16 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      );
    }

    if (type === 'success') {
      return (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 dark:bg-emerald-500/20">
          <svg
            className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    }

    // Error icon
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/20">
        <svg
          className="h-8 w-8 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#fafafa] dark:bg-[#0a0a0a] transition-colors">
      {/* Logo at top */}
      <div className="flex justify-center pt-8 pb-4">
        <Image
          src="/assets/logo_svg/clink_logo_black.svg"
          alt="Clink"
          className="w-28 dark:hidden"
          width={112}
          height={33}
          priority
        />
        <Image
          src="/assets/logo_svg/clink_logo_white.svg"
          alt="Clink"
          className="w-28 hidden dark:block"
          width={112}
          height={33}
          priority
        />
      </div>

      {/* Main content centered */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Icon */}
            <div className="mb-1">
              {renderIcon()}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100" style={{ letterSpacing: '-0.5px' }}>
              {title}
            </h2>

            {/* Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed">
              {message}
            </p>

            {/* Additional Message */}
            {additionalMessage && (
              <p className="text-xs text-gray-500 dark:text-gray-500 max-w-[280px]">
                {additionalMessage}
              </p>
            )}

            {/* Children */}
            {children}

            {/* Button */}
            {button && (
              <button
                onClick={button.onClick}
                className="mt-2 bg-gray-900 dark:bg-white hover:opacity-90 rounded-xl px-8 py-3 text-sm font-medium text-white dark:text-gray-900 transition-all"
                style={{ fontWeight: '600' }}
              >
                {button.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
