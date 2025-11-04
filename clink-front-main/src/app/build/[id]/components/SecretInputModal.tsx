'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SecretField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

interface SecretInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  secrets: SecretField[];
  sessionId: string;
  projectId: string;
  message?: string;
  requestId?: string;
}

export default function SecretInputModal({
  isOpen,
  onClose,
  secrets,
  sessionId,
  projectId,
  message,
  requestId,
}: SecretInputModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setValues({});
    setShowPassword({});
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate required fields
    for (const secret of secrets) {
      if (secret.required && !values[secret.key]?.trim()) {
        setError(`${secret.label} is required`);
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.request(
        `/api/chat/${projectId}/sessions/${sessionId}/secrets`,
        {
          method: 'POST',
          body: {
            secrets: values,
            requestId, // Include requestId to resolve pending MCP request
          },
        }
      );

      setSuccess(true);
      toast.success('Secrets submitted successfully');

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Secret submission error:', err);
      setError(err.message || 'Failed to submit secrets');
      toast.error('Failed to submit secrets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
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
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-interactive-secondary dark:bg-interactive-secondary rounded-full flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary dark:text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Environment Secrets Required
                  </h2>
                  <p className="text-sm text-gray-500">
                    {message || 'Please provide the following environment secrets'}
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
                    Secrets Submitted!
                  </h3>
                  <p className="text-gray-600">
                    Your secrets have been saved securely and the session will continue.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    These secrets will be stored encrypted and made available as environment variables in your workspace.
                  </p>

                  {/* Secret Fields */}
                  {secrets.map((secret) => (
                    <div key={secret.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {secret.label}
                        {secret.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword[secret.key] ? 'text' : 'password'}
                          value={values[secret.key] || ''}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [secret.key]: e.target.value,
                            }))
                          }
                          required={secret.required}
                          placeholder={secret.placeholder || `Enter ${secret.label}`}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-primary rounded-lg text-gray-900 dark:text-primary bg-white placeholder-gray-400 font-mono text-sm"
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(secret.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          disabled={isSubmitting}
                        >
                          {showPassword[secret.key] ? (
                            <EyeOff className="w-4 h-4 text-gray-500 dark:text-primary" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-500 dark:text-primary" />
                          )}
                        </button>
                      </div>
                      {secret.placeholder && (
                        <p className="text-xs text-gray-500 mt-1">
                          Example: {secret.placeholder}
                        </p>
                      )}
                    </div>
                  ))}

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

                  {/* Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      🔒 All secrets are encrypted before storage and only accessible within this project.
                    </p>
                  </div>

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
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit'
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