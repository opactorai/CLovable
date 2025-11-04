'use client';

import React, { useState, useEffect } from 'react';
// OAuth service placeholder - would be implemented separately

type Provider = 'claude' | 'gemini' | 'codex';

interface OAuthConnectProps {
  onSuccess?: (provider: Provider, sessionId: string) => void;
  onError?: (error: Error) => void;
}

export default function OAuthConnect({
  onSuccess,
  onError,
}: OAuthConnectProps) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [connected, setConnected] = useState<Record<Provider, boolean>>({
    claude: false,
    gemini: false,
    codex: false,
  });

  useEffect(() => {
    // Listen for OAuth success events
    const handleOAuthSuccess = (event: CustomEvent) => {
      const { provider, sessionId } = event.detail;
      setConnected((prev) => ({ ...prev, [provider]: true }));
      setLoading(null);

      if (onSuccess) {
        onSuccess(provider, sessionId);
      }
    };

    window.addEventListener('oauth-success' as any, handleOAuthSuccess);

    return () => {
      window.removeEventListener('oauth-success' as any, handleOAuthSuccess);
    };
  }, [onSuccess]);

  const handleConnect = async (provider: Provider) => {
    try {
      setLoading(provider);
      // OAuth flow would be implemented here
    } catch (error) {
      console.error(`Failed to connect ${provider}:`, error);
      setLoading(null);

      if (onError) {
        onError(error as Error);
      }
    }
  };

  const providers: {
    id: Provider;
    name: string;
    icon: string;
    color: string;
  }[] = [
    {
      id: 'claude',
      name: 'Claude',
      icon: '🤖',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      icon: '✨',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'codex',
      name: 'Codex',
      icon: '💻',
      color: 'bg-green-600 hover:bg-green-700',
    },
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Connect AI Providers
      </h2>

      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{provider.icon}</span>
              <span className="text-lg font-medium text-gray-700">
                {provider.name}
              </span>
              {connected[provider.id] && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Connected
                </span>
              )}
            </div>

            <button
              onClick={() => handleConnect(provider.id)}
              disabled={loading !== null || connected[provider.id]}
              className={`
                px-4 py-2 rounded-md text-white font-medium
                transition-colors duration-200
                ${
                  connected[provider.id]
                    ? 'bg-gray-400 cursor-not-allowed'
                    : provider.color
                }
                ${loading === provider.id ? 'opacity-50' : ''}
              `}
            >
              {loading === provider.id ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </span>
              ) : connected[provider.id] ? (
                'Connected'
              ) : (
                'Connect'
              )}
            </button>
          </div>
        ))}
      </div>

      {loading && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            A new window has opened for authentication. Please complete the
            login process there.
          </p>
        </div>
      )}
    </div>
  );
}
