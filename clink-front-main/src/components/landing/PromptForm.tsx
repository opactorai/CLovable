'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ChevronDown, Plus, Loader2, AlertCircle, Image as ImageIcon, X, CodeXml, FastForward } from 'lucide-react';
import { ASSISTANT_OPTIONS, AssistantKey } from '@/lib/assistant-options';
import ImportRepositoryModal from './ImportRepositoryModal';

interface ImageMetadata {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadedImage {
  file: File;
  metadata?: ImageMetadata;
  uploading?: boolean;
  error?: string;
}

interface SelectedRepository {
  name: string;
  fullName: string;
  url: string;
  branch: string;
  description?: string;
  githubInstallationId?: number;
}

interface PromptFormProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  selectedAssistant: AssistantKey;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelDropdownOpen: boolean;
  setModelDropdownOpen: (open: boolean) => void;
  setProviderDropdownOpen: (open: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  uploadedImages?: UploadedImage[];
  onImageUpload?: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage?: (index: number) => void;
  onImagePaste?: (files: File[]) => void;
  selectedRepository?: SelectedRepository | null;
  setSelectedRepository?: (repo: SelectedRepository | null) => void;
  mode: 'base' | 'dev';
  setMode: (mode: 'base' | 'dev') => void;
}

export default function PromptForm({
  prompt,
  setPrompt,
  isLoading,
  selectedAssistant,
  selectedModel,
  setSelectedModel,
  modelDropdownOpen,
  setModelDropdownOpen,
  setProviderDropdownOpen,
  handleSubmit,
  uploadedImages = [],
  onImageUpload,
  onRemoveImage,
  onImagePaste,
  selectedRepository,
  setSelectedRepository,
  mode,
  setMode,
}: PromptFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropupRef = useRef<HTMLDivElement>(null);
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const isDevMode = mode === 'dev';
  const devToggleAria = isDevMode ? 'Dev mode enabled' : 'Dev mode disabled';
  const modelOptions = ASSISTANT_OPTIONS[selectedAssistant].models;
  const currentModelOption =
    modelOptions.find((model) => model.value === selectedModel) ||
    modelOptions[0];

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        setIsDropupOpen(false);
      }
    };

    if (isDropupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropupOpen]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onImagePaste) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      onImagePaste(imageFiles);
    }
  };

  const toggleDevMode = () => {
    if (isDevMode) {
      setMode('base');
      setSelectedRepository?.(null);
      setIsImportModalOpen(false);
    } else {
      setMode('dev');
    }
  };

  return (
    <div
      className="mb-6"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <form
        onSubmit={handleSubmit}
        className="group flex flex-col gap-2 p-2 sm:p-4 w-full max-w-full sm:max-w-2xl mx-auto transition-all duration-150 ease-in-out"
        style={{
          backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
          backdropFilter: 'blur(12px) saturate(150%)',
          WebkitBackdropFilter: 'blur(12px) saturate(150%)',
          borderRadius: '16px',
          marginTop: '0px',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
            0px 4px 12px 0px color-mix(in srgb, #000 12%, transparent),
            0px 8px 24px 0px color-mix(in srgb, #000 10%, transparent)
          `,
          transition:
            'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)',
        }}
      >
        {/* Image Preview - Above textarea, inside form */}
        {uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2">
            {uploadedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(image.file)}
                  alt={`Upload ${index + 1}`}
                  className="w-12 h-12 object-cover rounded-md border border-white/20"
                />
                {image.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
                {image.error && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center rounded-md">
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                {onRemoveImage && !image.uploading && (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-white/90 hover:bg-white text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="relative flex flex-1 items-center">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePaste}
            placeholder={isDevMode ? "Create with any stack or import from GitHub to start building..." : "Ask Clink to create a web app that..."}
            className="flex w-full rounded-xl px-3 sm:px-4 py-2 sm:py-3 bg-transparent text-white placeholder-white
            focus:outline-none focus:placeholder-gray-200 resize-none text-[14px] sm:text-[16px] leading-snug
            max-h-[200px] sm:max-h-[240px] overflow-y-auto font-secondary font-medium prompt-scrollbar"
            style={{
              minHeight: '80px',
              height: '80px',
              color: '#ffffff',
              textShadow: '0 0.5px 1px rgba(255,255,255,0.6)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* File Upload Button - Left side */}
          {onImageUpload && (
            <div className="relative" ref={dropupRef}>
              <button
                type="button"
                onClick={() => setIsDropupOpen(!isDropupOpen)}
                className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full
                bg-transparent text-white hover:bg-white/10 transition-all flex-shrink-0"
                aria-label="Add content"
              >
                <motion.div
                  animate={{ rotate: isDropupOpen ? 45 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <Plus className="w-4 h-4 sm:w-4 sm:h-4" />
                </motion.div>
              </button>

              {/* Dropdown menu - Same design as model dropdown */}
              {isDropupOpen && (
                <div
                  className="absolute top-full mt-1 left-0 rounded-lg overflow-hidden z-50 bg-primary border border-primary shadow-lg"
                  style={{
                    minWidth: '100%',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setIsDropupOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm transition-colors whitespace-nowrap hover:bg-interactive-hover text-secondary"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>Images</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GitHub Import Button - Only show when DEV mode is active and no repository is selected */}
          {isDevMode && onImageUpload && !selectedRepository && (
            <div className="relative group/tooltip">
              <button
                type="button"
                onClick={() => {
                  // Check if user is logged in
                  const token = localStorage.getItem('token');
                  if (!token) {
                    // Redirect to login page
                    const currentPath = window.location.pathname + window.location.search;
                    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
                    return;
                  }
                  setIsImportModalOpen(true);
                }}
                className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full
                bg-transparent text-white/70 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                aria-label="Import from GitHub"
              >
                <svg className="h-4 w-4 sm:h-4 sm:w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </button>
              <span className="absolute bottom-full mb-0.5 px-3 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                Import from GitHub
              </span>
            </div>
          )}

          {/* Selected Repository Display */}
          {isDevMode && selectedRepository && (
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1 rounded-full bg-white/10 border border-white/20">
              <svg className="h-4 w-4 sm:h-4 sm:w-4 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-white text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[180px]">
                {selectedRepository.fullName}
              </span>
              {setSelectedRepository && (
                <button
                  type="button"
                  onClick={() => setSelectedRepository(null)}
                  className="flex-shrink-0 w-4 h-4 rounded-full hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Clear selection"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          )}

          <div className="relative provider-dropdown flex items-center gap-2" />

          {/* Action Buttons - Right side */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Model Dropdown */}
            <div className="relative model-dropdown">
              <button
                type="button"
                onClick={() => {
                  setModelDropdownOpen(!modelDropdownOpen);
                  setProviderDropdownOpen(false);
                }}
                className="flex items-center gap-1 sm:gap-2 px-2.5 py-0.5 h-8 sm:h-9 rounded-lg
                bg-black/[0.18] border border-black/[0.04] text-white hover:bg-white/15 transition-all text-xs sm:text-sm font-medium min-w-[70px]"
              >
                <span className="text-white font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none" suppressHydrationWarning>
                  {currentModelOption.label}
                </span>
                <ChevronDown
                  className={`w-2 h-2 sm:w-3 sm:h-3 transition-transform text-white flex-shrink-0 ${modelDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {modelDropdownOpen && (
                <div
                  className="absolute top-full mt-1 right-0 rounded-lg overflow-hidden z-50 bg-primary border border-primary shadow-lg"
                  style={{
                    minWidth: '100%',
                  }}
                >
                  {modelOptions.map((model) => (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => {
                        setSelectedModel(model.value);
                        setModelDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 w-full text-left text-sm transition-colors whitespace-nowrap hover:bg-interactive-hover ${
                        selectedModel === model.value
                          ? 'text-primary font-medium'
                          : 'text-secondary'
                      }`}
                    >
                      <span>{model.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mode Toggle - Segmented Control */}
            <div className="relative flex shrink-0 items-center p-0.5 bg-black/[0.18] border border-black/[0.04] rounded-lg">
              {/* BASE Mode Button */}
              <button
                type="button"
                onClick={() => !isDevMode || toggleDevMode()}
                className="relative focus:outline-none group/base-tooltip"
                aria-pressed={!isDevMode}
                aria-label="Base mode"
              >
                {!isDevMode && (
                  <motion.div
                    layoutId="segmented-bg"
                    className="pointer-events-none absolute inset-0 z-0 block bg-black bg-gradient-to-b from-white/20 to-white/20 border-white/30 border rounded-lg shadow-[0_1px_3px_0] shadow-white/5 transition-colors duration-300"
                  />
                )}
                <div className="relative z-10 flex h-7 min-w-9 items-center justify-center px-2.5 sm:h-8">
                  <FastForward className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors duration-300 ${
                    !isDevMode ? 'text-white' : 'text-white/50 hover:text-white/70'
                  }`} strokeWidth={1.7} />
                </div>
                {/* BASE Tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 px-3 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md opacity-0 group-hover/base-tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                  BASE - Quick web app generation
                </span>
              </button>

              {/* DEV Mode Button */}
              <button
                type="button"
                onClick={() => isDevMode || toggleDevMode()}
                className="relative focus:outline-none group/dev-tooltip"
                aria-pressed={isDevMode}
                aria-label="Dev mode"
              >
                {isDevMode && (
                  <motion.div
                    layoutId="segmented-bg"
                    className="pointer-events-none absolute inset-0 z-0 block bg-black bg-gradient-to-b from-white/20 to-white/20 border-white/30 border rounded-lg shadow-[0_1px_3px_0] shadow-white/5 transition-colors duration-300"
                  />
                )}
                <div className="relative z-10 flex h-7 min-w-9 items-center justify-center px-2.5 sm:h-8">
                  <CodeXml className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors duration-300 ${
                    isDevMode ? 'text-white' : 'text-white/50 hover:text-white/70'
                  }`} strokeWidth={1.7} />
                </div>
                {/* DEV Tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 px-3 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md opacity-0 group-hover/dev-tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                  DEV <span className="text-white font-bold">(BETA)</span> - Deploy any stack & container
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full
              bg-white text-black border border-gray-200
              hover:bg-gray-50 hover:border-gray-300 transition-all shadow-md hover:shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? (
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Hidden File Input */}
        {onImageUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={onImageUpload}
            className="hidden"
          />
        )}
      </form>

      {/* Import Repository Modal */}
      <ImportRepositoryModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(repositoryData) => {
          console.log('Repository selected:', repositoryData);
          // Set selected repository state instead of navigating
          if (setSelectedRepository && typeof repositoryData === 'object') {
            setSelectedRepository(repositoryData as SelectedRepository);
          }
        }}
      />
    </div>
  );
}
