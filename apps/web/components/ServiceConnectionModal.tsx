"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface ServiceConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'github' | 'supabase' | 'vercel';
  projectId?: string;
}

interface ServiceToken {
  id: string;
  provider: string;
  token: string;
  name?: string;
  created_at: string;
  last_used?: string;
}

export default function ServiceConnectionModal({ 
  isOpen, 
  onClose, 
  provider,
  projectId 
}: ServiceConnectionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState<ServiceToken | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load saved token on mount
  useEffect(() => {
    if (isOpen) {
      loadSavedToken();
    }
  }, [isOpen, provider]);

  const loadSavedToken = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tokens/${provider}`);
      if (response.ok) {
        const tokenData = await response.json();
        setSavedToken(tokenData);
      } else {
        setSavedToken(null);
      }
    } catch (error) {
      console.error('Failed to load saved token:', error);
      setSavedToken(null);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      alert('Please enter a valid token');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          token: token.trim(),
          name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Token`
        })
      });
      
      if (response.ok) {
        const savedTokenData = await response.json();
        setSavedToken(savedTokenData);
        setToken('');
        setShowTokenInput(false);
        // Use a more elegant notification instead of alert
        console.log('Token saved successfully!');
      } else {
        const error = await response.text();
        alert(`Failed to save token: ${error}`);
      }
    } catch (error) {
      console.error('Failed to save token:', error);
      alert('Failed to save token. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!savedToken || !confirm('Are you sure you want to delete this token?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/tokens/${savedToken.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setSavedToken(null);
        alert('Token deleted successfully!');
      } else {
        alert('Failed to delete token');
      }
    } catch (error) {
      console.error('Failed to delete token:', error);
      alert('Failed to delete token. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Service-specific actions using saved tokens
  const handleGitHubAction = async (action: string) => {
    if (!savedToken || !projectId) return;
    
    setActionLoading(true);
    try {
      if (action === 'create-repo') {
        const response = await fetch(`${API_BASE}/api/github/create-repo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_id: savedToken.id,
            repo_name: `cc-lovable-${projectId}`,
            private: false
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          alert(`Repository created: ${data.html_url}`);
        } else {
          const error = await response.text();
          alert(`Failed to create repository: ${error}`);
        }
      }
    } catch (error) {
      console.error('GitHub action failed:', error);
      alert('GitHub action failed. Please check your token.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupabaseAction = async (action: string) => {
    if (!savedToken || !projectId) return;
    
    setActionLoading(true);
    try {
      if (action === 'create-project') {
        const dbPass = prompt('Enter database password for new Supabase project:');
        if (!dbPass) return;
        
        const response = await fetch(`${API_BASE}/api/supabase/create-project`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_id: savedToken.id,
            project_name: `cc-lovable-${projectId}`,
            db_pass: dbPass,
            region: 'us-east-1'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          alert(`Supabase project created: ${data.name}`);
        } else {
          const error = await response.text();
          alert(`Failed to create project: ${error}`);
        }
      }
    } catch (error) {
      console.error('Supabase action failed:', error);
      alert('Supabase action failed. Please check your token.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVercelAction = async (action: string) => {
    if (!savedToken || !projectId) return;
    
    setActionLoading(true);
    try {
      if (action === 'deploy') {
        const response = await fetch(`${API_BASE}/api/vercel/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_id: savedToken.id,
            project_name: `cc-lovable-${projectId}`
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          alert(`Deployed to Vercel: ${data.url}`);
        } else {
          const error = await response.text();
          alert(`Failed to deploy: ${error}`);
        }
      }
    } catch (error) {
      console.error('Vercel action failed:', error);
      alert('Vercel action failed. Please check your token.');
    } finally {
      setActionLoading(false);
    }
  };

  const getProviderInfo = () => {
    switch (provider) {
      case 'github':
        return {
          title: 'GitHub',
          description: 'Connect with your GitHub Personal Access Token to create repositories and manage code',
          tokenUrl: 'https://github.com/settings/tokens',
          tokenName: 'Personal Access Token',
          icon: (
            <svg width="32" height="32" viewBox="0 0 98 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/>
            </svg>
          ),
          instructions: [
            "Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)",
            "Click 'Generate new token' → 'Generate new token (classic)'",
            "Enter a descriptive name (e.g., 'Clovable Integration')",
            "Select expiration (recommend 'No expiration' for development)",
            "Select scopes: 'repo' (full repository access) and 'user' (user profile access)",
            "Click 'Generate token' and copy the token immediately (you won't see it again!)",
            "Paste the token below and click 'Save Token'"
          ],
          actions: ['create-repo']
        };
      case 'supabase':
        return {
          title: 'Supabase',
          description: 'Connect with your Supabase Personal Access Token to manage projects and databases',
          tokenUrl: 'https://supabase.com/dashboard/account/tokens',
          tokenName: 'Personal Access Token',
          icon: (
            <svg width="32" height="32" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
              <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
              <defs>
                <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#249361"/>
                  <stop offset="1" stopColor="#3ECF8E"/>
                </linearGradient>
              </defs>
            </svg>
          ),
          instructions: [
            "Go to Supabase Dashboard → Account → Access Tokens",
            "Click 'Generate new token'",
            "Enter a descriptive name (e.g., 'Clovable Integration')",
            "Select appropriate expiration date (or no expiration for development)",
            "Click 'Generate token' and copy it immediately",
            "Paste the token below and click 'Save Token'"
          ],
          actions: ['create-project']
        };
      case 'vercel':
        return {
          title: 'Vercel',
          description: 'Connect with your Vercel API Token to deploy projects and manage domains',
          tokenUrl: 'https://vercel.com/account/tokens',
          tokenName: 'API Token',
          icon: (
            <svg width="32" height="32" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/>
            </svg>
          ),
          instructions: [
            "Go to Vercel Dashboard → Settings → Tokens",
            "Click 'Create Token'",
            "Enter a descriptive name (e.g., 'Clovable Integration')",
            "Select appropriate scope (recommend 'Full Access' for development)",
            "Set expiration date or select 'No Expiration'",
            "Click 'Create Token' and copy the token immediately",
            "Paste the token below and click 'Save Token'"
          ],
          actions: ['deploy']
        };
    }
  };

  const providerInfo = getProviderInfo();

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-gray-700 dark:text-gray-300">
                  {providerInfo.icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {providerInfo.title} {providerInfo.tokenName}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {providerInfo.description}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {savedToken ? (
              // Token is saved - show connection status and actions
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Token Connected
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>Name: {savedToken.name}</p>
                    <p>Provider: {savedToken.provider}</p>
                    <p className="text-xs mt-1">Added: {new Date(savedToken.created_at).toLocaleString()}</p>
                    {savedToken.last_used && (
                      <p className="text-xs">Last used: {new Date(savedToken.last_used).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {/* Service Actions */}
                {projectId && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Actions</h3>
                    {provider === 'github' && (
                      <button
                        onClick={() => handleGitHubAction('create-repo')}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating Repository...' : 'Create GitHub Repository'}
                      </button>
                    )}
                    {provider === 'supabase' && (
                      <button
                        onClick={() => handleSupabaseAction('create-project')}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating Project...' : 'Create Supabase Project'}
                      </button>
                    )}
                    {provider === 'vercel' && (
                      <button
                        onClick={() => handleVercelAction('deploy')}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Deploying...' : 'Deploy to Vercel'}
                      </button>
                    )}
                  </div>
                )}

                {!showTokenInput ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTokenInput(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Update Token
                    </button>
                    <button
                      onClick={handleDeleteToken}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Deleting...' : 'Delete Token'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter new {providerInfo.title} {providerInfo.tokenName}:
                      </label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={`Paste your new ${providerInfo.tokenName} here...`}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm transition-colors"
                        disabled={isLoading}
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        This will replace your current token. The old token will be permanently removed.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowTokenInput(false);
                          setToken('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveToken}
                        disabled={isLoading || !token.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Updating...' : 'Update Token'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // No token saved - show setup instructions and token input
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Setup Instructions
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-3">
                    To use {providerInfo.title} integration, you need to create a {providerInfo.tokenName} first.
                  </p>
                  <a
                    href={providerInfo.tokenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
                  >
                    Open {providerInfo.title} Token Settings
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Step-by-step Guide:
                  </h4>
                  <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                    {providerInfo.instructions.map((step, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Token Input Section - Always Visible */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enter your {providerInfo.title} {providerInfo.tokenName}:
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={`Paste your ${providerInfo.tokenName} here...`}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm transition-colors"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Your token will be encrypted and stored securely. You can delete it anytime.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveToken}
                    disabled={isLoading || !token.trim()}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Saving Token...' : 'Save Token'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}