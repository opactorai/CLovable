import { Github, ChevronRight, Check, X, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import Image from 'next/image';
import GitHubIntegrationPage from '../integrations/GitHubIntegrationPage';
import SupabaseIntegrationPage from '../integrations/SupabaseIntegrationPage';

interface IntegrationsTabProps {
  activeIntegration: 'supabase' | 'github' | 'other-apps' | null;
  setActiveIntegration: (integration: 'supabase' | 'github' | 'other-apps' | null) => void;
  projectId: string;
  hideSupabase?: boolean;
}

// Separate component for Other Apps to follow Hook rules
function OtherAppsIntegration({
  projectId,
  secrets,
  onSecretsUpdate
}: {
  projectId: string;
  secrets: Array<{ key: string; label: string }>;
  onSecretsUpdate: (secrets: Array<{ key: string; label: string }>) => void;
}) {
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isLoadingValue, setIsLoadingValue] = useState<Record<string, boolean>>({});

  const apps = [
    {
      key: 'RESEND_API_KEY',
      name: 'Resend',
      description: 'Email API for developers',
      logo: <Image src="/assets/logos/resend.svg" alt="Resend" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://resend.com/api-keys',
    },
    {
      key: 'stripe',
      name: 'Stripe',
      description: 'Online payment processing',
      logo: <Image src="/assets/logos/stripe.svg" alt="Stripe" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://docs.stripe.com/keys',
      fields: [
        {
          key: 'STRIPE_SECRET_KEY',
          label: 'Secret Key',
          placeholder: 'sk_test_...',
        },
        {
          key: 'STRIPE_PUBLISHABLE_KEY',
          label: 'Publishable Key',
          placeholder: 'pk_test_...',
        },
      ],
    },
    {
      key: 'GOOGLE_ANALYTICS_KEY',
      name: 'Google Analytics',
      description: 'Web analytics service',
      logo: <Image src="/assets/logos/google_analytics.svg" alt="Google Analytics" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://support.google.com/analytics/answer/12270356?hl=en',
    },
    {
      key: 'PERPLEXITY_API_KEY',
      name: 'Perplexity',
      description: 'AI-powered search engine',
      logo: <Image src="/assets/logos/perplexity.svg" alt="Perplexity" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://docs.perplexity.ai/guides/getting-started#generate-an-api-key',
    },
    {
      key: 'ANTHROPIC_API_KEY',
      name: 'Anthropic',
      description: 'Claude AI assistant',
      logo: <Image src="/assets/logos/anthropic.svg" alt="Anthropic" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    },
    {
      key: 'GEMINI_API_KEY',
      name: 'Gemini',
      description: 'Google AI models',
      logo: <Image src="/assets/logos/gemini.svg" alt="Gemini" width={24} height={24} unoptimized />,
      apiKeyUrl: 'https://aistudio.google.com/app/api-keys',
    },
    {
      key: 'OPENAI_API_KEY',
      name: 'OpenAI',
      description: 'GPT models and APIs',
      logo: <Image src="/assets/logos/openai.svg" alt="OpenAI" width={30} height={30} unoptimized />,
      apiKeyUrl: 'https://platform.openai.com/api-keys',
    },
    {
      key: 'twilio',
      name: 'Twilio',
      description: 'SMS and communication APIs',
      logo: (
        <svg className="w-6 h-6" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="15" fill="#F22F46"/>
          <circle cx="10" cy="10" r="2.5" fill="white"/>
          <circle cx="20" cy="10" r="2.5" fill="white"/>
          <circle cx="10" cy="20" r="2.5" fill="white"/>
          <circle cx="20" cy="20" r="2.5" fill="white"/>
        </svg>
      ),
      apiKeyUrl: 'https://help.twilio.com/articles/223136027-Auth-Tokens-and-How-to-Change-Them',
      fields: [
        {
          key: 'TWILIO_ACCOUNT_SID',
          label: 'Account SID',
          placeholder: 'AC...',
        },
        {
          key: 'TWILIO_AUTH_TOKEN',
          label: 'Auth Token',
          placeholder: 'Enter your auth token',
        },
        {
          key: 'TWILIO_FROM_PHONE_NUMBER',
          label: 'From Phone Number',
          placeholder: '+1234567890',
        },
      ],
    },
  ];

  const handleSaveApiKey = async (appKey: string) => {
    const app = apps.find(a => a.key === appKey);

    // Handle multi-field apps
    if (app?.fields) {
      const secrets: Record<string, string> = {};
      let hasEmpty = false;

      for (const field of app.fields) {
        const value = apiKeyValues[field.key];
        if (!value || !value.trim()) {
          hasEmpty = true;
          break;
        }
        secrets[field.key] = value;
      }

      if (hasEmpty) {
        toast.error('Please fill in all fields');
        return;
      }

      setIsSaving({ ...isSaving, [appKey]: true });

      try {
        const result = await apiClient.request<{
          success: boolean;
          message: string;
          daytona?: {
            synced: boolean;
            autoRestarted: boolean;
            requiresManualRestart?: boolean;
          };
          supabase?: {
            synced: boolean;
          };
        }>(`/api/chat/${projectId}/submit-secrets`, {
          method: 'POST',
          body: { secrets },
        });

        // Refresh secrets
        const data = await apiClient.request<Array<{ key: string; label: string }>>(
          `/api/chat/${projectId}/secrets`
        );
        onSecretsUpdate(data || []);

        // Show appropriate toast based on sync status
        if (result.daytona?.autoRestarted) {
          toast.success(
            'API keys saved and dev server restarted automatically! ✨',
            { duration: 5000 }
          );
        } else if (result.daytona?.requiresManualRestart) {
          toast.warning(
            'API keys saved! Please restart your dev server manually to apply changes.',
            { duration: 6000 }
          );
        } else {
          toast.success('API keys saved successfully!');
        }

        setExpandedApp(null);

        // Clear all field values
        const newValues = { ...apiKeyValues };
        app.fields.forEach(field => {
          delete newValues[field.key];
        });
        setApiKeyValues(newValues);
      } catch (error) {
        console.error('Failed to save API keys:', error);
        toast.error('Failed to save API keys');
      } finally {
        setIsSaving({ ...isSaving, [appKey]: false });
      }
    } else {
      // Handle single-field apps
      const value = apiKeyValues[appKey];
      if (!value || !value.trim()) {
        toast.error('Please enter a valid API key');
        return;
      }

      setIsSaving({ ...isSaving, [appKey]: true });

      try {
        const result = await apiClient.request<{
          success: boolean;
          message: string;
          daytona?: {
            synced: boolean;
            autoRestarted: boolean;
            requiresManualRestart?: boolean;
          };
          supabase?: {
            synced: boolean;
          };
        }>(`/api/chat/${projectId}/submit-secrets`, {
          method: 'POST',
          body: {
            secrets: { [appKey]: value },
          },
        });

        // Refresh secrets
        const data = await apiClient.request<Array<{ key: string; label: string }>>(
          `/api/chat/${projectId}/secrets`
        );
        onSecretsUpdate(data || []);

        // Show appropriate toast based on sync status
        if (result.daytona?.autoRestarted) {
          toast.success(
            'API key saved and dev server restarted automatically! ✨',
            { duration: 5000 }
          );
        } else if (result.daytona?.requiresManualRestart) {
          toast.warning(
            'API key saved! Please restart your dev server manually to apply changes.',
            { duration: 6000 }
          );
        } else {
          toast.success('API key saved successfully!');
        }

        setExpandedApp(null);
        setApiKeyValues({ ...apiKeyValues, [appKey]: '' });
      } catch (error) {
        console.error('Failed to save API key:', error);
        toast.error('Failed to save API key');
      } finally {
        setIsSaving({ ...isSaving, [appKey]: false });
      }
    }
  };

  const toggleExpand = (appKey: string) => {
    setExpandedApp(expandedApp === appKey ? null : appKey);
  };

  const toggleShowValue = async (appKey: string) => {
    const willShow = !showValues[appKey];

    // If showing and connected, fetch the actual value
    if (willShow && isConnected(appKey) && !apiKeyValues[appKey]) {
      setIsLoadingValue({ ...isLoadingValue, [appKey]: true });
      try {
        const data = await apiClient.request<{ value: string }>(
          `/api/chat/${projectId}/secrets/${appKey}/value`
        );
        setApiKeyValues({ ...apiKeyValues, [appKey]: data.value });
      } catch (error) {
        console.error('Failed to fetch secret value:', error);
        toast.error('Failed to load API key');
        return;
      } finally {
        setIsLoadingValue({ ...isLoadingValue, [appKey]: false });
      }
    }

    setShowValues({ ...showValues, [appKey]: willShow });
  };

  const isConnected = (appKey: string) => {
    const app = apps.find(a => a.key === appKey);
    if (app?.fields) {
      // For multi-field apps, check if all fields are connected
      return app.fields.every(field => secrets.some(s => s.key === field.key));
    }
    return secrets.some(s => s.key === appKey);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        {apps.map((app) => {
          const connected = isConnected(app.key);
          const expanded = expandedApp === app.key;
          const showValue = showValues[app.key] || false;
          const saving = isSaving[app.key] || false;

          return (
            <div key={app.key} className="border border-gray-200 dark:border-primary rounded-lg bg-white dark:bg-secondary">
              <button
                onClick={() => toggleExpand(app.key)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-interactive-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    {app.logo}
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">{app.name}</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {connected ? 'API key connected' : app.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-poppins" style={{ fontSize: '13px', fontWeight: '500' }}>
                      <Check className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full font-poppins bg-gray-100 dark:bg-interactive-secondary text-gray-700 dark:text-gray-300" style={{ fontSize: '13px', fontWeight: '500' }}>
                      Not connected
                    </span>
                  )}
                  <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                  {app.fields ? (
                    // Multi-field app (Stripe, Twilio)
                    app.fields.map((field) => {
                      const fieldKey = field.key;
                      const showFieldValue = showValues[fieldKey] || false;
                      const fieldConnected = secrets.some(s => s.key === fieldKey);

                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {field.label}
                          </label>
                          <div className="relative">
                            <input
                              type={showFieldValue ? 'text' : 'password'}
                              value={
                                apiKeyValues[fieldKey] ||
                                (fieldConnected && !apiKeyValues[fieldKey] ? '••••••••••••••••••••' : '')
                              }
                              onChange={(e) => setApiKeyValues({ ...apiKeyValues, [fieldKey]: e.target.value })}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 pr-10 border rounded-lg outline-none transition-all font-poppins dark:bg-secondary dark:text-white"
                              style={{
                                borderColor: '#e5e7eb',
                                fontSize: '14px',
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#1a1a1a'}
                              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                              readOnly={fieldConnected && !apiKeyValues[fieldKey]}
                            />
                            <button
                              onClick={() => toggleShowValue(fieldKey)}
                              disabled={isLoadingValue[fieldKey]}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              {isLoadingValue[fieldKey] ? (
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : showFieldValue ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Single-field app
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {app.name} API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showValue ? 'text' : 'password'}
                          value={
                            apiKeyValues[app.key] ||
                            (connected && !apiKeyValues[app.key] ? '••••••••••••••••••••' : '')
                          }
                          onChange={(e) => setApiKeyValues({ ...apiKeyValues, [app.key]: e.target.value })}
                          placeholder={`Enter your ${app.name} API key`}
                          className="w-full px-3 py-2 pr-10 border rounded-lg outline-none transition-all font-poppins dark:bg-secondary dark:text-white"
                          style={{
                            borderColor: '#e5e7eb',
                            fontSize: '14px',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#1a1a1a'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          readOnly={connected && !apiKeyValues[app.key]}
                        />
                        <button
                          onClick={() => toggleShowValue(app.key)}
                          disabled={isLoadingValue[app.key]}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          {isLoadingValue[app.key] ? (
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : showValue ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveApiKey(app.key)}
                        disabled={
                          saving ||
                          (app.fields
                            ? !app.fields.some(field => apiKeyValues[field.key])
                            : !apiKeyValues[app.key])
                        }
                        className="px-4 py-2 rounded-lg font-poppins transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: '#1a1a1a',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '500',
                        }}
                      >
                        {saving ? 'Saving...' : connected ? 'Update' : 'Save'}
                      </button>
                    </div>
                    <a
                      href={app.apiKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-poppins transition-colors hover:underline"
                      style={{
                        color: '#9ca3af',
                      }}
                    >
                      Get API Key →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IntegrationsTab({
  activeIntegration,
  setActiveIntegration,
  projectId,
  hideSupabase = false,
}: IntegrationsTabProps) {
  const [secrets, setSecrets] = useState<Array<{ key: string; label: string }>>([]);

  useEffect(() => {
    // Only fetch secrets if we have a valid projectId
    if (!projectId) {
      return;
    }

    const fetchSecrets = async () => {
      try {
        const data = await apiClient.request<Array<{ key: string; label: string }>>(
          `/api/chat/${projectId}/secrets`
        );
        setSecrets(data || []);
      } catch (error) {
        console.error('API request failed:', error);
        console.error('Failed to fetch secrets:', error);
      }
    };

    fetchSecrets();
  }, [projectId]);

  if (!hideSupabase && activeIntegration === 'supabase') {
    return (
      <SupabaseIntegrationPage
        projectId={projectId}
        onBack={() => setActiveIntegration(null)}
      />
    );
  }

  if (activeIntegration === 'github' || (hideSupabase && activeIntegration === 'supabase')) {
    return (
      <GitHubIntegrationPage
        projectId={projectId}
        onBack={() => setActiveIntegration(null)}
      />
    );
  }

  if (activeIntegration === 'other-apps') {
    return (
      <OtherAppsIntegration
        projectId={projectId}
        secrets={secrets}
        onSecretsUpdate={setSecrets}
      />
    );
  }

  // Default integrations list view
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Integrations
      </h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
        Connect your project with external services and tools.
      </p>

      <div className="space-y-3">
        {!hideSupabase && (
          <button
            onClick={() => setActiveIntegration('supabase')}
            className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left bg-white dark:bg-gray-800"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 109 113" fill="none">
                    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
                    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
                    <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
                    <defs>
                      <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#249361"/>
                        <stop offset="1" stopColor="#3ECF8E"/>
                      </linearGradient>
                      <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                        <stop/>
                        <stop offset="1" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Supabase
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Backend as a Service for your project
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
          </button>
        )}

        <button
          onClick={() => setActiveIntegration('github')}
          className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left bg-white dark:bg-gray-800"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Github className="w-6 h-6 text-gray-900" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  GitHub
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Version control and collaboration platform
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
        </button>
      </div>
    </div>
  );
}
