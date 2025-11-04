'use client';

import { ChangeEvent, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AssistantSelector, { AssistantSelectorRef } from './AssistantSelector';
import PromptForm from './PromptForm';
import { AssistantKey, ASSISTANT_OPTIONS } from '@/lib/assistant-options';

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

interface HeroSectionProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  selectedAssistant: AssistantKey;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelDropdownOpen: boolean;
  setModelDropdownOpen: (open: boolean) => void;
  setProviderDropdownOpen: (open: boolean) => void;
  handleModelSelect: (assistantKey: AssistantKey) => void;
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




export default function HeroSection({
  prompt,
  setPrompt,
  isLoading,
  selectedAssistant,
  selectedModel,
  setSelectedModel,
  modelDropdownOpen,
  setModelDropdownOpen,
  setProviderDropdownOpen,
  handleModelSelect,
  handleSubmit,
  uploadedImages,
  onImageUpload,
  onRemoveImage,
  onImagePaste,
  selectedRepository,
  setSelectedRepository,
  mode,
  setMode,
}: HeroSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const assistantSelectorRef = useRef<AssistantSelectorRef>(null);

  // Memoize assistant keys
  const assistantKeys = useMemo(() => Object.keys(ASSISTANT_OPTIONS) as AssistantKey[], []);

  // Set video playback speed (1.0 is normal, 0.5 is half speed, 2.0 is double speed)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.50; // Adjust this value to control speed
    }
  }, []);

  // Handle global arrow key navigation for AI provider and model selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle left/right arrow keys for provider navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();

        if (e.key === 'ArrowLeft') {
          assistantSelectorRef.current?.navigatePrevious();
        } else {
          assistantSelectorRef.current?.navigateNext();
        }
      }

      // Handle up/down arrow keys for model navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentProviderModels = ASSISTANT_OPTIONS[selectedAssistant].models;
        const currentModelIndex = currentProviderModels.findIndex(
          (m) => m.value === selectedModel
        );

        let newModelIndex: number;
        if (e.key === 'ArrowUp') {
          newModelIndex = (currentModelIndex - 1 + currentProviderModels.length) % currentProviderModels.length;
        } else {
          newModelIndex = (currentModelIndex + 1) % currentProviderModels.length;
        }

        setSelectedModel(currentProviderModels[newModelIndex].value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssistant, selectedModel, setSelectedModel]);

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen h-screen px-3 sm:px-4 py-8 sm:py-0 relative overflow-hidden"
    >
      {/* Background Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        aria-label="Clink AI app builder interface demonstration"
        title="Clink vibe-coding experience - Build full-stack apps with AI"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: '50% 20%' }}
      >
        <source src="/assets/clink.webm" type="video/webm" />
      </video>

      {/* Content */}
      <div className="relative z-10 max-w-full sm:max-w-4xl mx-auto text-center w-full">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            type: 'spring',
            stiffness: 100,
          }}
          className="mb-8"
        >
          <h1 className="text-xl sm:text-2xl md:text-5xl leading-tight text-white mb-4 sm:mb-6 text-center mx-auto font-black font-primary px-2 whitespace-nowrap" style={{ textShadow: '0 0 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.9), 2px -2px 4px rgba(0, 0, 0, 0.9), -2px 2px 4px rgba(0, 0, 0, 0.9)' }}>
            Link, Click, Ship. Let's Clink
          </h1>

          <motion.p
            className="text-base sm:text-lg text-white font-medium font-poppins px-2"
            style={{ textShadow: '0 0 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.9), 2px -2px 4px rgba(0, 0, 0, 0.9), -2px 2px 4px rgba(0, 0, 0, 0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Web Builder for World's Best AI Agents
          </motion.p>
        </motion.div>

        {/* Integrated Tab + Form Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="relative w-full"
        >
          {/* Assistant Selector - Tabs on top */}
          <AssistantSelector
            ref={assistantSelectorRef}
            selectedAssistant={selectedAssistant}
            handleModelSelect={handleModelSelect}
          />

          {/* Prompt Form - Main box */}
          <PromptForm
            prompt={prompt}
            setPrompt={setPrompt}
            isLoading={isLoading}
            selectedAssistant={selectedAssistant}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            modelDropdownOpen={modelDropdownOpen}
            setModelDropdownOpen={setModelDropdownOpen}
            setProviderDropdownOpen={setProviderDropdownOpen}
            handleSubmit={handleSubmit}
            uploadedImages={uploadedImages}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
            onImagePaste={onImagePaste}
            selectedRepository={selectedRepository}
            setSelectedRepository={setSelectedRepository}
            mode={mode}
            setMode={setMode}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
