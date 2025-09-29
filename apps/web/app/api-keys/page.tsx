"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ApiKey {
  id: string;
  provider: string;
  name: string;
  created_at: string;
  last_used?: string;
}

interface ApiKeyForm {
  provider: string;
  token: string;
  name: string;
}

const PROVIDERS = [
  { id: "claude", name: "Claude (Anthropic)", description: "For Claude Code and Claude API access" },
  { id: "cursor", name: "Cursor", description: "For Cursor Agent CLI access" },
  { id: "openai", name: "OpenAI", description: "For Codex CLI and OpenAI API access" },
  { id: "google", name: "Google", description: "For Gemini CLI access" },
  { id: "qwen", name: "Qwen", description: "For Qwen Code CLI access" },
  { id: "github", name: "GitHub", description: "For GitHub integration" },
  { id: "supabase", name: "Supabase", description: "For database integration" },
  { id: "vercel", name: "Vercel", description: "For deployment integration" },
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ApiKeyForm>({
    provider: "",
    token: "",
    name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/tokens");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchApiKeys();
        setFormData({ provider: "", token: "", name: "" });
        setShowForm(false);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to save API key");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tokenId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const response = await fetch(`/api/tokens/${tokenId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchApiKeys();
      }
    } catch (err) {
      console.error("Failed to delete API key:", err);
    }
  };

  const getProviderInfo = (provider: string) => {
    return PROVIDERS.find(p => p.id === provider) || { name: provider, description: "" };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">API Keys Management</h1>
                <p className="text-gray-600 mt-2">
                  Manage your API keys for AI agents and integrations
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Add API Key
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Add New API Key</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a provider</option>
                      {PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.token}
                      onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter your API key"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., My Claude API Key"
                    />
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      {submitting ? "Saving..." : "Save API Key"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🔑</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No API Keys</h3>
                  <p className="text-gray-600 mb-6">
                    Add your first API key to start using AI agents
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Add API Key
                  </button>
                </div>
              ) : (
                apiKeys.map((key) => {
                  const providerInfo = getProviderInfo(key.provider);
                  return (
                    <motion.div
                      key={key.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <span className="text-indigo-600 font-semibold text-lg">
                                {key.provider.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {providerInfo.name}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {providerInfo.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                            <span>Created: {formatDate(key.created_at)}</span>
                            {key.last_used && (
                              <span>Last used: {formatDate(key.last_used)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Security Notice</h3>
              <p className="text-blue-800 text-sm">
                Your API keys are stored securely and encrypted. They are only used for the specific
                AI agent integrations you configure. Never share your API keys with others.
              </p>
            </div>
          </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}