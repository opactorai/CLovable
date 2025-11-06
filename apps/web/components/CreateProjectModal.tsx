"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { MotionDiv, MotionP } from '../lib/motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8080';

interface CLIOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: { id: string; name: string; description: string; supportsImages: boolean; }[];
  color: string;
  features: string[];
  downloadUrl?: string;
  installCommand?: string;
  enabled?: boolean;
}

const CLI_OPTIONS: CLIOption[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    icon: '🤖',
    description: 'Anthropic Claude with advanced reasoning',
    color: 'from-orange-500 to-red-600',
    downloadUrl: 'https://github.com/anthropics/claude-code',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    models: [
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Superior coding with 1M context window', supportsImages: true },
      { id: 'claude-opus-4.1', name: 'Claude Opus 4.1', description: 'Most intelligent model for complex coding tasks', supportsImages: true },
    ],
    features: ['Advanced reasoning', 'Code generation', '1M context window']
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    icon: '🎯',
    description: 'AI-powered code editor with frontier models',
    color: 'from-[#DE7356] to-[#c95940]',
    downloadUrl: 'https://cursor.com',
    installCommand: 'Download from cursor.com',
    models: [
      { id: 'gpt-5', name: 'GPT-5', description: 'Best coding model with expert-level intelligence', supportsImages: true },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'State-of-the-art coding capabilities', supportsImages: true },
      { id: 'claude-opus-4.1', name: 'Claude Opus 4.1', description: 'Most powerful model for complex tasks', supportsImages: true },
    ],
    features: ['IDE integration', 'Frontier models', 'Real-time coding']
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    icon: '🐉',
    description: 'Alibaba Qwen with agentic coding (Coming Soon)',
    color: 'from-red-500 to-pink-600',
    downloadUrl: 'https://github.com/QwenLM/qwen-code',
    installCommand: 'npm install -g @qwen-code/qwen-code',
    models: [
      { id: 'qwen3-coder-480b', name: 'Qwen3-Coder 480B', description: 'Most agentic coding model with 1M context', supportsImages: true },
      { id: 'qwen2.5-coder-32b', name: 'Qwen2.5-Coder 32B', description: 'SOTA open-source coding model', supportsImages: false },
    ],
    features: ['Agentic coding', '1M context window', 'Apache 2.0 license'],
    enabled: false
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    icon: '💎',
    description: 'Google Gemini with thinking capabilities (Coming Soon)',
    color: 'from-[#DE7356] to-[#e88a6f]',
    downloadUrl: 'https://github.com/google-gemini/gemini-cli',
    installCommand: 'npm install -g @google/generative-ai-cli',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'State-of-the-art thinking model with adaptive reasoning', supportsImages: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and versatile multimodal model', supportsImages: true },
    ],
    features: ['Adaptive thinking', 'Web search', '1M context window'],
    enabled: false
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    icon: '🔮',
    description: 'OpenAI Codex with GPT-5 integration (Coming Soon)',
    color: 'from-green-500 to-teal-600',
    downloadUrl: 'https://github.com/openai/codex',
    installCommand: 'npm install -g openai-codex-cli',
    models: [
      { id: 'gpt-5', name: 'GPT-5', description: 'Smartest coding model with built-in thinking', supportsImages: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Major improvements in coding and long-context', supportsImages: true },
      { id: 'o4-mini', name: 'OpenAI o4-mini', description: 'Reasoning model for complex problems', supportsImages: false },
    ],
    features: ['Built-in thinking', '1M context tokens', 'Open-source CLI'],
    enabled: false
  }
];

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onOpenGlobalSettings?: () => void;
}

export default function CreateProjectModal({ open, onClose, onCreated, onOpenGlobalSettings }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedCLI, setSelectedCLI] = useState<string>('claude');
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4.5');
  // Fallback is removed but kept for backward compatibility
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [useDefaultSettings, setUseDefaultSettings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializationStep, setInitializationStep] = useState('');
  const [showInitialization, setShowInitialization] = useState(false);
  const [initializingProjectId, setInitializingProjectId] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [enabledCLIs, setEnabledCLIs] = useState<CLIOption[]>([]);
  const [cliStatus, setCLIStatus] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [showWebsiteInput, setShowWebsiteInput] = useState(false);
  const [showCLIDropdown, setShowCLIDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const router = useRouter();

  // Load global settings and enabled CLIs when modal opens
  useEffect(() => {
    if (open && !globalSettings) {
      loadGlobalSettings();
    }
  }, [open]);

  const loadGlobalSettings = async () => {
    try {
      // Load both global settings and CLI status in parallel
      const [settingsResponse, statusResponse] = await Promise.all([
        fetch(`${API_BASE}/api/settings/global`),
        fetch(`${API_BASE}/api/settings/cli-status`)
      ]);

      let settings = null;
      let cliStatusData = null;

      if (settingsResponse.ok) {
        settings = await settingsResponse.json();
        setGlobalSettings(settings);
      }

      if (statusResponse.ok) {
        cliStatusData = await statusResponse.json();
        setCLIStatus(cliStatusData);
      }

      if (settings) {
        // Filter CLIs that are both enabled and installed
        const enabled = CLI_OPTIONS.filter(cli => {
          const isEnabled = settings.cli_settings?.[cli.id]?.enabled !== false;
          const isInstalled = cliStatusData?.[cli.id]?.installed !== false; // Allow if no status data
          const isAvailable = cli.enabled !== false; // Check CLI-level enabled flag
          return isEnabled && isInstalled && isAvailable;
        });
        
        setEnabledCLIs(enabled.length > 0 ? enabled : CLI_OPTIONS);
        
        // Apply global defaults
        const defaultCLI = settings.default_cli || 'claude';
        const availableDefaultCLI = enabled.find(cli => cli.id === defaultCLI);
        
        // Use default CLI if it's available, otherwise use first available CLI
        if (availableDefaultCLI) {
          setSelectedCLI(defaultCLI);
        } else if (enabled.length > 0) {
          setSelectedCLI(enabled[0].id);
        } else {
          setSelectedCLI('claude');
        }
        
        setFallbackEnabled(settings.fallback_enabled ?? true);
        
        // Set default model for the selected CLI
        const selectedCLIId = availableDefaultCLI ? defaultCLI : (enabled[0]?.id || 'claude');
        const cliSettings = settings.cli_settings?.[selectedCLIId];
        if (cliSettings?.model) {
          setSelectedModel(cliSettings.model);
          console.log('Using global settings model:', cliSettings.model, 'for CLI:', selectedCLIId);
        } else {
          // Set first available model
          const selectedCLIObj = enabled.find(cli => cli.id === selectedCLIId) || enabled[0];
          if (selectedCLIObj?.models.length) {
            setSelectedModel(selectedCLIObj.models[0].id);
            console.log('Using first available model:', selectedCLIObj.models[0].id, 'for CLI:', selectedCLIId);
          }
        }
      } else {
        console.error('Failed to load global settings:', settingsResponse.statusText);
        // Use available CLIs as fallback, filter by installation status and enabled flag
        const available = cliStatusData ? CLI_OPTIONS.filter(cli => 
          cliStatusData[cli.id]?.installed !== false && cli.enabled !== false
        ) : CLI_OPTIONS.filter(cli => cli.enabled !== false);
        
        setEnabledCLIs(available);
        const firstCLI = available[0]?.id || 'claude';
        setSelectedCLI(firstCLI);
        const firstModel = available[0]?.models[0]?.id || 'claude-sonnet-4.5';
        setSelectedModel(firstModel);
        setFallbackEnabled(true);
        console.log('Fallback: Selected CLI:', firstCLI, 'Model:', firstModel);
      }
    } catch (error) {
      console.error('Failed to load global settings:', error);
      // Use available CLIs as fallback
      setEnabledCLIs(CLI_OPTIONS.filter(cli => cli.enabled !== false));
      const fallbackCLI = 'claude';
      const fallbackModel = 'claude-sonnet-4.5';
      setSelectedCLI(fallbackCLI);
      setSelectedModel(fallbackModel);
      setFallbackEnabled(true);
      console.log('Error fallback: Selected CLI:', fallbackCLI, 'Model:', fallbackModel);
    }
  };

  const selectedCLIOption = enabledCLIs.find(cli => cli.id === selectedCLI);
  const selectedModelOption = selectedCLIOption?.models.find(model => model.id === selectedModel);

  // WebSocket connection for project initialization
  const connectToProjectWebSocket = (projectId: string) => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/api/chat/${projectId}`);
      
      ws.onopen = () => {
        reconnectAttempts = 0; // Reset attempts on successful connection
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'project_status') {
            const { status, message } = data.data || data;
            console.log('📊 Project status received:', status, message);
            
            if (message) {
              setInitializationStep(message);
            }
            
            if (status === 'active') {
              // Project ready, close modal and navigate
              setTimeout(() => {
                ws.close();
                handleInitializationComplete(projectId);
              }, 1000);
            } else if (status === 'failed') {
              setInitializationStep('Project initialization failed');
              setTimeout(() => {
                ws.close();
                setShowInitialization(false);
                setInitializingProjectId(null);
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        
        // Only attempt reconnection if it wasn't a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000); // Exponential backoff, max 10s
          console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          
          reconnectTimeout = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. Please refresh the page.');
          setInitializationStep('Connection lost. Please refresh the page.');
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ Initialization WebSocket error:', error);
      };

      return ws;
    };

    const ws = connect();
    
    // Return cleanup function
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Component unmounting');
      }
    };
  };

  // Handle successful initialization completion
  const handleInitializationComplete = (projectId: string) => {
    // Store the initial prompt before resetting
    const initialPrompt = prompt;
    
    // Reset form
    setProjectName('');
    setPrompt('');
    setImageUrl('');
    setWebsiteUrl('');
    setShowImageInput(false);
    setShowWebsiteInput(false);
    setUseDefaultSettings(true);
    setImageError('');
    setShowInitialization(false);
    setInitializingProjectId(null);
    
    // Reset to global defaults or fallback
    if (globalSettings) {
      setSelectedCLI(globalSettings.default_cli || 'claude');
      setFallbackEnabled(globalSettings.fallback_enabled ?? true);
      const cliSettings = globalSettings.cli_settings?.[globalSettings.default_cli || 'claude'];
      setSelectedModel(cliSettings?.model || 'claude-sonnet-4.5');
    } else {
      setSelectedCLI('claude');
      setSelectedModel('claude-sonnet-4.5');
      setFallbackEnabled(true);
    }
    
    // Close modal and navigate to chat with initial prompt
    onClose();
    
    // Construct the URL with initial prompt as a query parameter if it exists
    const chatUrl = initialPrompt 
      ? `/${projectId}/chat?initial_prompt=${encodeURIComponent(initialPrompt)}`
      : `/${projectId}/chat`;
    
    router.push(chatUrl);
  };


  // Check for image compatibility
  useEffect(() => {
    if (imageUrl && selectedModelOption && !selectedModelOption.supportsImages) {
      setImageError(`The selected model "${selectedModelOption.name}" does not support image inputs. Please choose a different model or remove the image.`);
    } else {
      setImageError('');
    }
  }, [imageUrl, selectedModelOption]);

  const handleCLIChange = (cliId: string) => {
    setSelectedCLI(cliId);
    // Auto-select first model for the selected CLI
    const cli = enabledCLIs.find(c => c.id === cliId);
    if (cli?.models.length) {
      setSelectedModel(cli.models[0].id);
    }
    setShowCLIDropdown(false);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDropdown(false);
  };

  async function submit() {
    if (!projectName.trim() || !prompt.trim()) return;
    
    // Determine CLI and model based on useDefaultSettings
    let finalCLI = selectedCLI;
    let finalModel = selectedModel;
    
    if (useDefaultSettings && globalSettings) {
      finalCLI = globalSettings.default_cli || 'claude';
      const cliSettings = globalSettings.cli_settings?.[finalCLI];
      finalModel = cliSettings?.model || selectedModel || 'claude-sonnet-4.5';
    }
    
    if (!finalCLI || !finalModel) {
      console.error('Missing CLI or model selection:', { finalCLI, finalModel, useDefaultSettings, globalSettings });
      return;
    }
    
    // Check image compatibility before submitting
    if (imageUrl && selectedModelOption && !selectedModelOption.supportsImages) {
      return; // Don't submit if there's an image compatibility error
    }
    
    console.log('Creating project with:', { finalCLI, finalModel, useDefaultSettings, globalSettings });
    
    const name = projectName.trim() || 'New Project';
    const projectUuid = generateUUID();
    
    // 1. Show loading spinner immediately
    setLoading(false); // Turn off button loading
    setShowInitialization(true); // Show initialization spinner immediately
    setInitializationStep('Preparing project...');
    setInitializingProjectId(projectUuid);
    
    // 2. Start WebSocket connection
    const wsCleanup = connectToProjectWebSocket(projectUuid);
    
    try {
      const projectData: any = { 
        project_id: projectUuid, 
        name, 
        description: prompt,
        initial_prompt: prompt,
        preferred_cli: finalCLI,
        fallback_enabled: fallbackEnabled,
        selected_model: finalModel,
        cli_settings: {
          [finalCLI]: {
            model: finalModel
          }
        }
      };

      // Add URL and image if provided
      if (websiteUrl) {
        projectData.website_url = websiteUrl;
      }
      if (imageUrl) {
        projectData.image_url = imageUrl;
      }
      
      console.log('Sending project data:', JSON.stringify(projectData, null, 2));
      
      // 3. Project creation request
      setInitializationStep('Creating project...');
      
      const apiUrl = `${API_BASE}/api/projects/`;
      const r = await fetch(apiUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(projectData) 
      });
      
      if (!r.ok) {
        const errorText = await r.text();
        setInitializationStep(`Failed to create project: ${errorText}`);
        setTimeout(() => {
          setShowInitialization(false);
          alert(`Error: ${errorText}`);
        }, 2000);
        return;
      }
      
      // 4. On success, wait for real-time progress via WebSocket
      setInitializationStep('Setting up environment...');
      onCreated();
      
      // Add fallback timeout and polling mechanism in case WebSocket doesn't respond
      let pollInterval: NodeJS.Timeout | null = null;
      
      // Start polling project status as a fallback
      pollInterval = setInterval(async () => {
        try {
          console.log('📊 Polling project status for:', projectUuid);
          const response = await fetch(`${API_BASE}/api/projects/${projectUuid}`);
          if (response.ok) {
            const project = await response.json();
            console.log('📊 Project status from polling:', project.status);
            
            if (project.status === 'active') {
              if (pollInterval) clearInterval(pollInterval);
              setInitializationStep('Project ready! Redirecting...');
              setTimeout(() => {
                handleInitializationComplete(projectUuid);
              }, 1000);
            } else if (project.status === 'failed') {
              if (pollInterval) clearInterval(pollInterval);
              setInitializationStep('Project initialization failed');
              setTimeout(() => {
                setShowInitialization(false);
                setInitializingProjectId(null);
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Error polling project status:', error);
        }
      }, 3000); // Poll every 3 seconds
      
      // Ultimate fallback timeout
      setTimeout(() => {
        if (showInitialization && initializingProjectId === projectUuid) {
          console.log('⏰ Ultimate timeout reached, redirecting to chat page as fallback');
          if (pollInterval) clearInterval(pollInterval);
          setInitializationStep('Project ready! Redirecting...');
          setTimeout(() => {
            handleInitializationComplete(projectUuid);
          }, 1000);
        }
      }, 60000); // 60 second ultimate timeout
      
    } catch (error) {
      console.error('Error creating project:', error);
      setShowInitialization(false);
      setInitializingProjectId(null);
      alert(`An error occurred during execution: ${error}`);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (useDefaultSettings && globalSettings) {
        submit();
      }
    }
  };

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Project</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Describe your project and configure your AI assistant
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Project Name and Description */}
          <div className="space-y-4 mb-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My awesome project"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={100}
              />
            </div>

          </div>

          {/* Project Description */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">✨</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              What would you like to build?
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Describe your project idea in detail
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 mb-4">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="I want to build a social media app with user profiles, posts, and real-time chat..."
              className="w-full h-32 border-none outline-none resize-none bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 leading-relaxed"
              autoFocus
              maxLength={1000}
            />
            
            {/* Input Actions Row */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                {/* Image Upload Button */}
                <button
                  onClick={() => setShowImageInput(!showImageInput)}
                  className={`p-2 rounded-lg transition-colors ${
                    showImageInput || imageUrl
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title="Add reference image"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="21,15 16,10 5,21" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>

                {/* Website URL Button */}
                <button
                  onClick={() => setShowWebsiteInput(!showWebsiteInput)}
                  className={`p-2 rounded-lg transition-colors ${
                    showWebsiteInput || websiteUrl
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title="Add reference website"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>

              <span className="text-xs text-gray-500 dark:text-gray-400">
                {prompt.length}/1000 characters
              </span>
            </div>
          </div>

          {/* Dynamic Input Fields */}
          <AnimatePresence>
            {showImageInput && (
              <MotionDiv
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    🖼️ Reference Image URL
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/30 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {imageError && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{imageError}</p>
                    </div>
                  )}
                </div>
              </MotionDiv>
            )}

            {showWebsiteInput && (
              <MotionDiv
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    🌐 Reference Website URL
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-green-900/30 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </MotionDiv>
            )}
          </AnimatePresence>

          {/* AI Configuration */}
          <div className="space-y-4 mb-6">
            {/* Use Default Settings Toggle */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => setUseDefaultSettings(!useDefaultSettings)}
                className="mt-0.5 flex-shrink-0"
              >
                <div className={`w-5 h-5 border-2 rounded transition-colors ${
                  useDefaultSettings 
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {useDefaultSettings && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white dark:text-gray-900">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
              <div className="flex-1">
                <label 
                  onClick={() => setUseDefaultSettings(!useDefaultSettings)}
                  className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                >
                  Use default AI settings
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {globalSettings ? (
                    <>Use {enabledCLIs.find(cli => cli.id === globalSettings.default_cli)?.name || 'default'} AI with your preferred model. Change this in <button 
                      onClick={() => {
                        onClose();
                        onOpenGlobalSettings?.();
                      }}
                      className="text-gray-900 dark:text-white hover:underline"
                    >Global Settings</button>.</>
                  ) : (
                    <>Quick start with Claude AI. Customize AI preferences in <button 
                      onClick={() => {
                        onClose();
                        onOpenGlobalSettings?.();
                      }}
                      className="text-gray-900 dark:text-white hover:underline"
                    >Global Settings</button>.</>
                  )}
                </p>
              </div>
            </div>

            {/* AI Selection Dropdowns */}
            {!useDefaultSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CLI Selection Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    AI Assistant
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowCLIDropdown(!showCLIDropdown)}
                      className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{selectedCLIOption?.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{selectedCLIOption?.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{selectedCLIOption?.description}</div>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${showCLIDropdown ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    <AnimatePresence>
                      {showCLIDropdown && (
                        <MotionDiv
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                        >
                          {enabledCLIs.map((cli) => {
                            const cliStatusInfo = cliStatus?.[cli.id];
                            const isInstalled = cliStatusInfo?.installed ?? true;
                            
                            return (
                              <button
                                key={cli.id}
                                onClick={() => handleCLIChange(cli.id)}
                                className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-3 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                              >
                                <span className="text-lg">{cli.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-gray-900 dark:text-white">{cli.name}</div>
                                    {isInstalled ? (
                                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full">
                                        !
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{cli.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Model Selection Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Model
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-white">{selectedModelOption?.name}</div>
                          {selectedModelOption?.supportsImages && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                              📷
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{selectedModelOption?.description}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    <AnimatePresence>
                      {showModelDropdown && selectedCLIOption && (
                        <MotionDiv
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                        >
                          {selectedCLIOption.models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleModelChange(model.id)}
                              className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium text-gray-900 dark:text-white">{model.name}</div>
                                {model.supportsImages && (
                                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                                    📷
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{model.description}</div>
                            </button>
                          ))}
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button 
              className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={submit}
              disabled={loading || !projectName.trim() || !prompt.trim() || !!imageError}
            >
              {loading ? 'Creating Project...' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Project Initialization Loading Modal */}
      <AnimatePresence>
        {showInitialization && (
          <MotionDiv 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            
            {/* Modal Content */}
            <MotionDiv 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md mx-auto text-center border border-gray-800"
            >
              {/* Sophisticated Multi-Layer Spinner */}
              <div className="relative mb-10 flex justify-center">
                {/* Outer ring */}
                <MotionDiv
                  className="absolute w-20 h-20 border-2 border-gray-700 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Middle ring */}
                <MotionDiv
                  className="absolute w-16 h-16 border-2 border-t-white border-r-gray-500 border-b-gray-500 border-l-gray-500 rounded-full"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Inner ring */}
                <MotionDiv
                  className="w-12 h-12 border-2 border-t-gray-300 border-r-gray-600 border-b-gray-600 border-l-gray-600 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Center dot */}
                <MotionDiv
                  className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              
              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-3">
                Setting Up Your Project
              </h3>
              
              <MotionP 
                key={initializationStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-gray-300 mb-8"
              >
                {initializationStep || 'Preparing workspace...'}
              </MotionP>
              
              {/* Progress indicator dots */}
              <div className="flex justify-center space-x-2">
                {[0, 1, 2].map((i) => (
                  <MotionDiv
                    key={i}
                    className="w-2 h-2 bg-gray-500 rounded-full"
                    animate={{
                      backgroundColor: ['#6B7280', '#E5E7EB', '#6B7280'],
                      scale: [1, 1.2, 1]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.3
                    }}
                  />
                ))}
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}