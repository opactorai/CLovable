'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Loader2, Upload, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import Image from 'next/image';
import { useTheme } from '@/contexts/BuildThemeContext';

type Provider = 'claude' | 'codex' | 'gemini' | 'zai';

interface ManualSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProvider?: Provider;
}

const PROVIDER_INFO = {
  claude: {
    name: 'Claude',
    logo: '/assets/provider/claude.png',
    npmCommand: 'npm install -g @anthropic-ai/claude-code@latest',
    setupCommand: 'claude setup-token',
    loginCommand: 'claude',
    instruction: 'Run claude setup-token and log in to Claude. Then paste the token below.',
    fileLocation: null,
    uploadType: 'token' as const,
  },
  codex: {
    name: 'ChatGPT',
    logo: '/assets/provider/openai.png',
    npmCommand: 'npm install -g @openai/codex@latest',
    setupCommand: 'codex login',
    loginCommand: null,
    instruction: 'Run codex login, then upload the',
    fileLocation: '~/.codex/auth.json',
    uploadType: 'file' as const,
  },
  gemini: {
    name: 'Gemini',
    logo: '/assets/provider/gemini.png',
    npmCommand: 'npm install -g @google/gemini-cli@latest',
    setupCommand: 'gemini',
    loginCommand: 'google account',
    instruction: 'Run gemini and log in. Then upload the',
    fileLocation: '~/.gemini/oauth_creds.json',
    uploadType: 'file' as const,
  },
  zai: {
    name: 'Z.ai',
    logo: '', // Will be determined by theme at render time
    npmCommand: null,
    setupCommand: 'Create a new API key',
    setupUrl: 'https://z.ai/manage-apikey/apikey-list',
    loginCommand: 'zai',
    instruction: 'and paste the generated API Key in the token field below.',
    fileLocation: null,
    uploadType: 'token' as const,
    warning: 'Image analysis and Web Search are available starting from the Pro plan. For details, please refer to the ',
    warningLinkText: 'Subscription page',
    warningLinkUrl: 'https://z.ai/subscribe',
  },
};

export default function ManualSetupModal({
  isOpen,
  onClose,
  onSuccess,
  initialProvider = 'claude',
}: ManualSetupModalProps) {
  const { theme } = useTheme();
  const [selectedProvider, setSelectedProvider] = useState<Provider>(initialProvider);
  const [tokenInput, setTokenInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const providerInfo = PROVIDER_INFO[selectedProvider];

  // Sync selectedProvider with initialProvider when modal opens or prop changes
  useEffect(() => {
    if (isOpen && initialProvider) {
      setSelectedProvider(initialProvider);
      setTokenInput('');
      setSelectedFile(null);
      setError(null);
    }
  }, [isOpen, initialProvider]);

  const handleClose = () => {
    if (isSubmitting) return;
    setTokenInput('');
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    setSelectedProvider('claude');
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please drop a valid JSON file.');
    }
  };

  const copyPathToClipboard = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const copyCommandToClipboard = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      let tokenData;

      if (providerInfo.uploadType === 'token') {
        // Claude: wrap token in JSON
        if (!tokenInput.trim()) {
          throw new Error('Please enter a token.');
        }
        tokenData = { token: tokenInput.trim() };
      } else {
        // Codex/Gemini: read and parse file
        if (!selectedFile) {
          throw new Error('Please select a file.');
        }

        const fileContent = await selectedFile.text();
        try {
          tokenData = JSON.parse(fileContent);
        } catch (parseError) {
          throw new Error('Invalid JSON file. Please check the file.');
        }
      }

      // Map provider names to backend format
      const providerMapping: Record<Provider, string> = {
        claude: 'CLAUDE',
        codex: 'CODEX',
        gemini: 'GEMINI',
        zai: 'ZAI',
      };

      const requestData = {
        provider: providerMapping[selectedProvider],
        tokenData,
        description: `Manually added ${providerInfo.name} token`,
        metadata: {
          source: 'manual_setup',
          provider: selectedProvider,
          addedAt: new Date().toISOString(),
        },
      };

      const result = await apiClient.manualTokenInsert(requestData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 1500);
      } else {
        throw new Error((result as any).message || 'Failed to save token.');
      }
    } catch (err: any) {
      console.error('Token submission error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 p-0 md:p-4 flex items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="bg-secondary rounded-none md:rounded-3xl w-full max-w-5xl h-full md:h-[85vh] overflow-hidden flex flex-col md:flex-row font-poppins border-0 md:border border-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-primary flex flex-col shrink-0">
              <div className="px-4 md:px-8 py-4 md:py-6">
                <h2
                  className="mb-1 text-primary text-lg md:text-xl"
                  style={{
                    fontWeight: '600',
                    letterSpacing: '-0.4px',
                  }}
                >
                  Manual Setup
                </h2>
                <p className="text-xs md:text-sm text-secondary">
                  Connect AI providers manually
                </p>
              </div>

              <nav className="flex-1 px-3 md:px-6 py-4 md:py-8 overflow-y-auto">
                <div className="space-y-2">
                  <div>
                    <h3
                      className="text-xs mb-3 px-3 font-poppins text-tertiary"
                      style={{
                        fontWeight: '500',
                      }}
                    >
                      Providers
                    </h3>
                    <div className="space-y-1">
                      {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => (
                        <button
                          key={provider}
                          onClick={() => {
                            setSelectedProvider(provider);
                            setTokenInput('');
                            setSelectedFile(null);
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className={`w-full text-left px-3 md:px-4 py-2 md:py-2.5 rounded-lg flex items-center gap-2 md:gap-3 transition-all font-poppins ${
                            selectedProvider === provider
                              ? 'bg-interactive-hover text-primary border border-primary'
                              : 'text-secondary hover:bg-interactive-hover border border-transparent'
                          }`}
                          style={{
                            fontWeight: selectedProvider === provider ? '500' : '400',
                            fontSize: '14px',
                          }}
                        >
                          {provider === 'zai' ? (
                            <Image
                              src={theme === 'dark' ? '/assets/agents/zai_light.png' : '/assets/agents/zai_dark.png'}
                              alt={PROVIDER_INFO[provider].name}
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain"
                            />
                          ) : provider === 'codex' ? (
                            <Image
                              src={theme === 'dark' ? '/assets/provider/openai.png' : '/assets/logos/openai-black-logo.png'}
                              alt={PROVIDER_INFO[provider].name}
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain"
                            />
                          ) : (
                            <Image
                              src={PROVIDER_INFO[provider].logo}
                              alt={PROVIDER_INFO[provider].name}
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain"
                            />
                          )}
                          <span>
                            {PROVIDER_INFO[provider].name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-5 border-b border-primary shrink-0">
                <h3
                  className="font-poppins text-primary text-base md:text-lg"
                  style={{
                    fontWeight: '600',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {providerInfo.name} Setup
                </h3>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="p-1.5 md:p-2 hover:bg-interactive-hover rounded-lg transition-colors text-secondary disabled:opacity-50"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 scrollbar-hide">
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-primary mb-2">
                      Token Added Successfully!
                    </h3>
                    <p className="text-secondary">
                      Your {providerInfo.name} token has been saved and encrypted.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Installation Guide */}
                    <div className="mb-6 md:mb-8">
                      <h4 className="text-sm md:text-base font-semibold text-primary mb-3 md:mb-4">
                        Installation Guide
                      </h4>
                      <div className="space-y-3 md:space-y-4">
                        {selectedProvider !== 'zai' && providerInfo.npmCommand && (
                          <div>
                            <p className="text-xs md:text-sm text-secondary mb-2">
                              1. Install the NPM package:
                            </p>
                            <div className="bg-[#1e1e1e] rounded-lg p-3 md:p-4 relative group">
                              <code className="text-xs md:text-sm text-[#d4d4d4] font-mono pr-10 break-all">
                                {providerInfo.npmCommand}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyCommandToClipboard(providerInfo.npmCommand!)}
                                className="absolute top-2 md:top-3 right-2 md:right-3 p-1 md:p-1.5 rounded hover:bg-white/10 transition-colors md:opacity-0 md:group-hover:opacity-100"
                                title="Copy command"
                              >
                                {copiedCommand === providerInfo.npmCommand ? (
                                  <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs md:text-sm text-secondary mb-2">
                            {selectedProvider === 'zai' ? (
                              <>
                                <a
                                  href={'setupUrl' in providerInfo ? providerInfo.setupUrl : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                >
                                  {providerInfo.setupCommand}
                                </a>{' '}
                                {providerInfo.instruction}
                              </>
                            ) : (
                              <>
                                2. {providerInfo.instruction}
                                {providerInfo.uploadType === 'file' && (
                                  <>
                                    {' '}
                                    <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 px-2 py-1 rounded font-mono text-xs">
                                      {providerInfo.fileLocation}
                                    </span>
                                    {' file.'}
                                  </>
                                )}
                              </>
                            )}
                          </p>
                          {selectedProvider !== 'zai' && (
                            <div className="bg-[#1e1e1e] rounded-lg p-3 md:p-4 relative group">
                              <code className="text-xs md:text-sm text-[#d4d4d4] font-mono pr-10 break-all">
                                {providerInfo.setupCommand}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyCommandToClipboard(providerInfo.setupCommand)}
                                className="absolute top-2 md:top-3 right-2 md:right-3 p-1 md:p-1.5 rounded hover:bg-white/10 transition-colors md:opacity-0 md:group-hover:opacity-100"
                                title="Copy command"
                              >
                                {copiedCommand === providerInfo.setupCommand ? (
                                  <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Warning Section for Z.ai */}
                    {'warning' in providerInfo && (
                      <div className="mb-6 md:mb-8">
                        <p className="text-xs md:text-sm text-secondary leading-relaxed">
                          {providerInfo.warning}
                          {'warningLinkText' in providerInfo && 'warningLinkUrl' in providerInfo && (
                            <a
                              href={providerInfo.warningLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              {providerInfo.warningLinkText}
                            </a>
                          )}
                          .
                        </p>
                      </div>
                    )}

                    {/* Form Section */}
                    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                      {providerInfo.uploadType === 'token' ? (
                        /* Token Input for Claude */
                        <div>
                          <label className="block text-xs md:text-sm font-medium text-primary mb-2">
                            Token
                          </label>
                          <div className="relative">
                            <input
                              type={showToken ? 'text' : 'password'}
                              value={tokenInput}
                              onChange={(e) => setTokenInput(e.target.value)}
                              placeholder="Paste your token here..."
                              autoComplete="off"
                              spellCheck={false}
                              className="w-full px-3 md:px-4 py-2.5 md:py-3 pr-10 md:pr-12 text-sm md:text-base bg-[#1e1e1e] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-[#252525] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#1e1e1e_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#ffffff]"
                              disabled={isSubmitting}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowToken(!showToken)}
                              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 hover:bg-white/10 rounded transition-colors"
                              tabIndex={-1}
                            >
                              {showToken ? (
                                <EyeOff className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                              ) : (
                                <Eye className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* File Upload for Codex/Gemini */
                        <div>
                          <label className="block text-xs md:text-sm font-medium text-primary mb-2">
                            Upload File:{' '}
                            <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 px-1.5 md:px-2 py-0.5 md:py-1 rounded font-mono text-[10px] md:text-xs">
                              {providerInfo.fileLocation?.split('/').pop()}
                            </span>
                          </label>

                          {/* File path help */}
                          <div className="mb-3 p-2 md:p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
                            <p className="text-[10px] md:text-xs text-blue-700 dark:text-blue-400 mb-2 font-medium">
                              📁 How to find the file:
                            </p>
                            <div className="space-y-2 md:space-y-1">
                              {/* macOS */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1 text-[10px] md:text-xs text-blue-700 dark:text-blue-300">
                                  <span className="font-semibold shrink-0">macOS:</span>
                                  <span className="hidden md:inline">Open Finder → Press</span>
                                  <span className="md:hidden">Finder →</span>
                                  <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-white/10 rounded text-[9px] md:text-[10px] shrink-0">⌘ Cmd</kbd>
                                  <span>+</span>
                                  <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-white/10 rounded text-[9px] md:text-[10px] shrink-0">⇧ Shift</kbd>
                                  <span>+</span>
                                  <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-white/10 rounded text-[9px] md:text-[10px] shrink-0">G</kbd>
                                  <span className="hidden md:inline">→ Paste:</span>
                                </div>
                                <div className="flex items-center gap-1 bg-blue-100 dark:bg-black/30 rounded p-1.5 md:p-1">
                                  <code className="text-[9px] md:text-[10px] text-blue-800 dark:text-blue-300 break-all flex-1">
                                    {providerInfo.fileLocation}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => copyPathToClipboard(providerInfo.fileLocation || '')}
                                    className="p-1 hover:bg-blue-200 dark:hover:bg-white/10 rounded transition-colors shrink-0"
                                  >
                                    {copiedPath === providerInfo.fileLocation ? (
                                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-blue-600 dark:text-blue-300" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Windows */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1 text-[10px] md:text-xs text-blue-700 dark:text-blue-300">
                                  <span className="font-semibold shrink-0">Windows:</span>
                                  <span className="hidden md:inline">Open File Explorer → Paste</span>
                                  <span className="md:hidden">File Explorer →</span>
                                  <span className="hidden md:inline">in address bar</span>
                                </div>
                                <div className="flex items-center gap-1 bg-blue-100 dark:bg-black/30 rounded p-1.5 md:p-1">
                                  <code className="text-[9px] md:text-[10px] text-blue-800 dark:text-blue-300 break-all flex-1">
                                    %USERPROFILE%{providerInfo.fileLocation?.replace('~', '')}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => copyPathToClipboard(`%USERPROFILE%${providerInfo.fileLocation?.replace('~', '') || ''}`)}
                                    className="p-1 hover:bg-blue-200 dark:hover:bg-white/10 rounded transition-colors shrink-0"
                                  >
                                    {copiedPath === `%USERPROFILE%${providerInfo.fileLocation?.replace('~', '') || ''}` ? (
                                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-blue-600 dark:text-blue-300" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              type="file"
                              accept=".json"
                              onChange={handleFileChange}
                              className="hidden"
                              id="file-upload"
                              disabled={isSubmitting}
                            />
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              className={`relative w-full px-4 py-8 border-2 border-dashed rounded-lg transition-all ${
                                isDragging
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : selectedFile
                                  ? 'border-green-500/50 bg-green-500/5'
                                  : 'border-white/20 bg-[#1e1e1e]'
                              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="flex flex-col items-center gap-3">
                                <Upload className={`w-8 h-8 transition-colors ${
                                  isDragging
                                    ? 'text-blue-400'
                                    : selectedFile
                                    ? 'text-green-400'
                                    : 'text-secondary'
                                }`} />

                                {selectedFile ? (
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-green-400 mb-1">
                                      ✓ {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-tertiary mb-3">
                                      File ready to upload
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFile(null);
                                        const input = document.getElementById('file-upload') as HTMLInputElement;
                                        if (input) input.value = '';
                                      }}
                                      className="text-xs text-red-400 hover:text-red-300 underline"
                                    >
                                      Remove file
                                    </button>
                                  </div>
                                ) : isDragging ? (
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-blue-400">
                                      Drop your JSON file here
                                    </p>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-primary mb-1">
                                      Drag & drop your JSON file here
                                    </p>
                                    <p className="text-xs text-tertiary mb-3">
                                      or click to browse
                                    </p>
                                    <label
                                      htmlFor="file-upload"
                                      className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors cursor-pointer"
                                    >
                                      Browse Files
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error Display */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400"
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">{error}</span>
                        </motion.div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 md:gap-3 pt-3 md:pt-4">
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={isSubmitting}
                          className="flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-primary text-secondary rounded-lg hover:bg-interactive-hover transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            (providerInfo.uploadType === 'token'
                              ? !tokenInput.trim()
                              : !selectedFile)
                          }
                          className="flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            'Submit'
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
