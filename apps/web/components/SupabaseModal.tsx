/**
 * Supabase Integration Modal
 * Create Supabase project and configure environment variables
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onSuccess: () => void;
}

interface SupabaseOrganization {
  id: string;
  name: string;
  slug: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
  created_at: string;
  database: {
    host: string;
    version: string;
  };
}

interface SupabaseApiKeys {
  anon: string;
  service_role: string;
}

export default function SupabaseModal({ isOpen, onClose, projectId, projectName, onSuccess }: SupabaseModalProps) {
  const [step, setStep] = useState<'token' | 'configure' | 'creating' | 'success'>('token');
  const [accessToken, setAccessToken] = useState('');
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [supabaseProjectName, setSupabaseProjectName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [dbPassword, setDbPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdProject, setCreatedProject] = useState<SupabaseProject | null>(null);

  const regions = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-1', name: 'US West (N. California)' },
    { id: 'eu-west-1', name: 'Europe (Ireland)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' }
  ];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('token');
      setAccessToken('');
      setOrganizations([]);
      setSelectedOrgId('');
      setSupabaseProjectName(projectName);
      setSelectedRegion('us-east-1');
      setDbPassword(generateSecurePassword());
      setError('');
      setCreatedProject(null);
    }
  }, [isOpen, projectName]);

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const fetchOrganizations = async () => {
    if (!accessToken.trim()) {
      setError('Please enter your Supabase Personal Access Token');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.status} ${response.statusText}`);
      }

      const orgs = await response.json();
      setOrganizations(orgs);
      
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
        setStep('configure');
      } else {
        setError('No organizations found. Please create an organization in Supabase first.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const createSupabaseProject = async () => {
    if (!selectedOrgId || !supabaseProjectName.trim() || !dbPassword.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');
    setStep('creating');

    try {
      // 1. Create Supabase project
      const createResponse = await fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization_id: selectedOrgId,
          name: supabaseProjectName,
          region: selectedRegion,
          db_pass: dbPassword
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.text();
        throw new Error(`Failed to create project: ${createResponse.status} - ${errorData}`);
      }

      const newProject: SupabaseProject = await createResponse.json();
      setCreatedProject(newProject);

      // 2. Wait for project to be active
      await waitForProjectActive(newProject.id);

      // 3. Get API keys
      const apiKeys = await getProjectApiKeys(newProject.id);

      // 4. Save environment variables
      await saveEnvironmentVariables(newProject, apiKeys);

      // 5. Save service connection
      await saveServiceConnection(newProject);

      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to create Supabase project');
      setStep('configure');
    } finally {
      setIsLoading(false);
    }
  };

  const waitForProjectActive = async (supabaseProjectId: string) => {
    const maxAttempts = 30; // 5 minutes max wait
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${supabaseProjectId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const project = await response.json();
          if (project.status === 'ACTIVE_HEALTHY') {
            return;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
      }
    }

    throw new Error('Project took too long to become active');
  };

  const getProjectApiKeys = async (supabaseProjectId: string): Promise<SupabaseApiKeys> => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${supabaseProjectId}/api-keys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get API keys: ${response.status}`);
    }

    return await response.json();
  };

  const saveEnvironmentVariables = async (project: SupabaseProject, apiKeys: SupabaseApiKeys) => {
    const envVars = [
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        value: `https://${project.id}.supabase.co`,
        scope: 'runtime',
        var_type: 'string',
        is_secret: false,
        description: 'Supabase project URL'
      },
      {
        key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        value: apiKeys.anon,
        scope: 'runtime',
        var_type: 'string',
        is_secret: false,
        description: 'Supabase anonymous key for client-side'
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        value: apiKeys.service_role,
        scope: 'runtime',
        var_type: 'string',
        is_secret: true,
        description: 'Supabase service role key for server-side'
      },
      {
        key: 'DATABASE_URL',
        value: `postgres://postgres:${dbPassword}@db.${project.id}.supabase.co:5432/postgres`,
        scope: 'runtime',
        var_type: 'string',
        is_secret: true,
        description: 'PostgreSQL database connection URL'
      }
    ];

    for (const envVar of envVars) {
      const response = await fetch(`${API_BASE}/api/env/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envVar)
      });

      if (!response.ok) {
        console.error(`Failed to save env var ${envVar.key}:`, await response.text());
      }
    }
  };

  const saveServiceConnection = async (project: SupabaseProject) => {
    const connectionData = {
      provider: 'supabase',
      status: 'connected',
      service_data: {
        project_id: project.id,
        project_name: project.name,
        project_url: `https://supabase.com/dashboard/project/${project.id}`,
        region: project.region,
        database_host: project.database.host,
        created_at: project.created_at
      }
    };

    const response = await fetch(`${API_BASE}/api/projects/${projectId}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(connectionData)
    });

    if (!response.ok) {
      throw new Error('Failed to save service connection');
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
              <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
              <defs>
                <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#249361"/>
                  <stop offset="1" stopColor="#3ECF8E"/>
                </linearGradient>
              </defs>
            </svg>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connect Supabase
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6L18 18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'token' && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supabase Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Enter your PAT from Supabase Dashboard"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get your token from{' '}
                    <a
                      href="https://supabase.com/dashboard/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Supabase Account Settings
                    </a>
                  </p>
                </div>

                <button
                  onClick={fetchOrganizations}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Fetching Organizations...' : 'Continue'}
                </button>
                </motion.div>
              </div>
            )}

            {step === 'configure' && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-white [&>option]:dark:bg-gray-700 [&>option]:text-gray-900 [&>option]:dark:text-white"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={supabaseProjectName}
                    onChange={(e) => setSupabaseProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-white [&>option]:dark:bg-gray-700 [&>option]:text-gray-900 [&>option]:dark:text-white"
                  >
                    {regions.map(region => (
                      <option key={region.id} value={region.id} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Database Password
                  </label>
                  <input
                    type="password"
                    value={dbPassword}
                    onChange={(e) => setDbPassword(e.target.value)}
                    placeholder="Secure password for your database"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setDbPassword(generateSecurePassword())}
                    className="text-xs text-blue-500 hover:underline mt-1"
                  >
                    Generate secure password
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('token')}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={createSupabaseProject}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Project
                  </button>
                </div>
                </motion.div>
              </div>
            )}

            {step === 'creating' && (
              <div className="text-center py-8">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Creating Supabase Project
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This may take a few minutes...
                </p>
                {createdProject && (
                  <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                    <p>✅ Project created: {createdProject.name}</p>
                    <p>⏳ Waiting for activation...</p>
                    <p>🔑 Fetching API keys...</p>
                    <p>💾 Setting up environment variables...</p>
                  </div>
                )}
                </motion.div>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-8">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Supabase Connected!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your Supabase project has been created and configured successfully.
                </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
        </motion.div>
      </div>
    </div>
  );
}