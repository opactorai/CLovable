'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ManualTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'openai' | 'claude' | 'gemini';
  onSuccess?: () => void;
}

type ProviderInfo = {
  name: string;
  logo: string;
  example: any;
  description: string;
};

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  openai: {
    name: 'ChatGPT / OpenAI',
    logo: '/assets/provider/openai.png',
    description: 'Enter your OpenAI API credentials',
    example: {
      api_key: 'sk-proj-...',
      organization: 'org-...',
      project_id: 'proj-...',
    },
  },
  claude: {
    name: 'Claude',
    logo: '/assets/provider/claude.png',
    description: 'Enter your Anthropic API credentials',
    example: {
      api_key: 'sk-ant-api03-...',
      organization: 'org-...',
    },
  },
  gemini: {
    name: 'Gemini',
    logo: '/assets/provider/gemini.png',
    description: 'Enter your Google AI API credentials',
    example: {
      api_key: 'AIza...',
      project_id: 'your-project-id',
    },
  },
};

export default function ManualTokenModal({
  isOpen,
  onClose,
  provider,
  onSuccess,
}: ManualTokenModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const providerInfo = PROVIDER_INFO[provider];

  const handleClose = () => {
    if (isSubmitting) return;
    setJsonInput('');
    setDescription('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // Parse JSON input
      let tokenData;
      try {
        tokenData = JSON.parse(jsonInput.trim());
      } catch (parseError) {
        throw new Error('Invalid JSON format. Please check your input.');
      }

      // Map provider names to backend format
      const providerMapping: Record<string, string> = {
        openai: 'CODEX', // OpenAI maps to CODEX in backend
        claude: 'CLAUDE',
        gemini: 'GEMINI',
      };

      const requestData = {
        provider: providerMapping[provider] || provider.toUpperCase(),
        tokenData,
        description:
          description.trim() || `Manually added ${providerInfo.name} token`,
        metadata: {
          source: 'manual_input',
          provider: provider,
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
        throw new Error((result as any).message || 'Failed to save token');
      }
    } catch (err: any) {
      console.error('Token submission error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertExample = () => {
    setJsonInput(JSON.stringify(providerInfo.example, null, 2));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <img
                  src={providerInfo.logo}
                  alt={providerInfo.name}
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Add {providerInfo.name} Token
                  </h2>
                  <p className="text-sm text-gray-500">
                    {providerInfo.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Token Added Successfully!
                  </h3>
                  <p className="text-gray-600">
                    Your {providerInfo.name} token has been saved and encrypted.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={`My ${providerInfo.name} API key`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-400"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* JSON Input */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Token Data (JSON)
                      </label>
                      <button
                        type="button"
                        onClick={insertExample}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                        disabled={isSubmitting}
                      >
                        Insert Example
                      </button>
                    </div>
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder={`{\n  "api_key": "your-api-key-here",\n  "organization": "your-org-id"\n}`}
                      className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-gray-900 bg-gray-50 placeholder-gray-400"
                      style={{
                        lineHeight: '1.4',
                        fontSize: '14px',
                      }}
                      disabled={isSubmitting}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter your API credentials in JSON format. All data is
                      encrypted before storage.
                    </p>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !jsonInput.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Token'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
