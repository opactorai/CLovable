import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ASSISTANT_OPTIONS,
  AssistantKey,
  normalizeCli,
} from '@/lib/assistant-options';
import { trackProviderSelected } from '@/lib/analytics';

export const useProviderSelection = () => {
  const searchParams = useSearchParams();

  // Initialize state with default values to avoid hydration mismatch
  // Will be updated from localStorage in useEffect
  const defaultProvider: 'openai' | 'claude' | 'gemini' | 'zai' = 'openai';
  const defaultAssistant = normalizeCli(defaultProvider);
  const defaultModel = ASSISTANT_OPTIONS[defaultAssistant].models[0].value;

  const [selectedProvider, setSelectedProvider] = useState<
    'openai' | 'claude' | 'gemini' | 'zai'
  >(defaultProvider);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [selectedAssistant, setSelectedAssistant] =
    useState<AssistantKey>(defaultAssistant);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Load from localStorage on client side
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedProvider = localStorage.getItem('lastSelectedProvider');
    if (savedProvider && ['openai', 'claude', 'gemini', 'zai'].includes(savedProvider)) {
      const provider = savedProvider as 'openai' | 'claude' | 'gemini' | 'zai';
      const assistantKey = normalizeCli(provider);
      setSelectedProvider(provider);
      setSelectedAssistant(assistantKey);
      setSelectedModel(ASSISTANT_OPTIONS[assistantKey].models[0].value);
    }
  }, []);

  const handleProviderSelect = useCallback(
    (provider: 'openai' | 'claude' | 'gemini' | 'zai') => {
      setSelectedProvider(provider);
      const assistantKey = normalizeCli(provider);
      setSelectedAssistant(assistantKey);
      const defaultModel = ASSISTANT_OPTIONS[assistantKey].models[0].value;
      setSelectedModel(defaultModel);
      setProviderDropdownOpen(false);
      setModelDropdownOpen(false);

      // Save to localStorage and track provider selection
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastSelectedProvider', provider);
        const hasSelectedBefore = localStorage.getItem('hasSelectedProvider');
        const isFirstTime = !hasSelectedBefore;
        trackProviderSelected(provider, isFirstTime);
        if (isFirstTime) {
          localStorage.setItem('hasSelectedProvider', 'true');
        }
        // Save selected provider to localStorage
        localStorage.setItem('lastSelectedProvider', provider);
      }
    },
    [],
  );

  const handleModelSelect = useCallback((assistantKey: AssistantKey) => {
    setSelectedAssistant(assistantKey);
    setSelectedModel(ASSISTANT_OPTIONS[assistantKey].models[0].value);
    const providerMap: Record<AssistantKey, 'openai' | 'claude' | 'gemini' | 'zai'> = {
      codex: 'openai',
      claude: 'claude',
      gemini: 'gemini',
      glm: 'zai',
    };
    const provider = providerMap[assistantKey];
    setSelectedProvider(provider);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSelectedProvider', provider);
    }
  }, []);

  // Handle provider selection from URL parameters
  useEffect(() => {
    const provider = searchParams.get('provider');
    if (provider && ['openai', 'claude', 'gemini', 'zai'].includes(provider)) {
      setSelectedProvider(provider as 'openai' | 'claude' | 'gemini' | 'zai');

      const providerToAssistant: Record<string, AssistantKey> = {
        openai: 'codex',
        claude: 'claude',
        gemini: 'gemini',
        zai: 'glm',
      };

      const assistantKey = providerToAssistant[provider];
      if (assistantKey) {
        setSelectedAssistant(assistantKey);
        setSelectedModel(ASSISTANT_OPTIONS[assistantKey].models[0].value);
      }
    }
  }, [searchParams]);

  // Ensure model is valid for current assistant
  useEffect(() => {
    const assistant = normalizeCli(selectedProvider);
    const models = ASSISTANT_OPTIONS[assistant].models;

    // Update assistant if it doesn't match provider
    if (selectedAssistant !== assistant) {
      setSelectedAssistant(assistant);
    }

    // Update model if it's not in the current assistant's model list
    if (!models.some((m) => m.value === selectedModel)) {
      setSelectedModel(models[0].value);
    }
  }, [selectedProvider, selectedAssistant, selectedModel]);

  const activeAssistant = normalizeCli(selectedProvider);
  const modelOptions = ASSISTANT_OPTIONS[activeAssistant].models;
  const currentModelOption =
    modelOptions.find((model) => model.value === selectedModel) ||
    modelOptions[0];

  return {
    selectedProvider,
    selectedModel,
    selectedAssistant,
    providerDropdownOpen,
    modelDropdownOpen,
    activeAssistant,
    modelOptions,
    currentModelOption,
    setSelectedProvider,
    setSelectedModel,
    setProviderDropdownOpen,
    setModelDropdownOpen,
    handleProviderSelect,
    handleModelSelect,
  };
};
