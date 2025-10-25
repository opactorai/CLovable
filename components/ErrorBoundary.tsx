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
            잠시 연결이 불안정합니다
          </h2>
          <p className="text-sm text-blue-600 dark:text-blue-300 mb-6 text-center max-w-md">
            채팅 연결에 일시적인 문제가 발생했습니다. 몇 초 후 자동으로 다시 시도하거나, 아래 버튼을 눌러 새로고침할 수 있습니다.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                // 자동 새로고침 대신 상태 초기화 시도
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              새로고침
            </button>
            <button
              onClick={() => {
                // 이전 페이지로 이동
                window.history.back();
              }}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md text-sm font-medium transition-colors"
            >
              이전으로
            </button>
          </div>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-4 text-center">
            문제가 계속되면 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
          </p>
        </div>
      }
      onError={(error) => {
        console.error('[ChatErrorBoundary] Error in chat component:', error);
        // 사용자에게 더 친숙한 오류 메시지
        console.log('💡 팁: 네트워크 연결을 확인하거나 페이지를 새로고침해보세요.');
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
