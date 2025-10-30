'use client';

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Chat Error Boundary
 * Specialized error boundary for chat components
 */
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center h-full p-8 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
          <div className="text-4xl mb-4">🔄</div>
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">
            The connection is temporarily unstable
          </h2>
          <p className="text-sm text-blue-600 dark:text-blue-300 mb-6 text-center max-w-md">
            We are experiencing a temporary issue with the chat connection. It will retry automatically in a few seconds, or you can click the button below to refresh now.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Attempt to reset state instead of relying on auto-refresh
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                // Navigate back to the previous page
                window.history.back();
              }}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md text-sm font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-4 text-center">
            If the issue continues, refresh the page or try again later.
          </p>
        </div>
      }
      onError={(error) => {
        console.error('[ChatErrorBoundary] Error in chat component:', error);
        // Provide a more user-friendly error message
        console.log('💡 Tip: Check your network connection or refresh the page.');
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
