"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Image as ImageIcon, X, ChevronDown, ChevronUp, Check, Plus } from 'lucide-react';
import NextImage from 'next/image';
import { ACTIVE_CLI_ICON_MAP, ACTIVE_CLI_IDS, ACTIVE_CLI_NAME_MAP, type ActiveCliId } from '@/lib/utils/cliOptions';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface UploadedImage {
  id: string;
  filename: string;
  path: string;
  url: string;
  assetUrl?: string;
  publicUrl?: string;
}

interface ModelPickerOption {
  id: string;
  name: string;
  cli: string;
  cliName: string;
  available: boolean;
}

interface CliPickerOption {
  id: string;
  name: string;
  available: boolean;
}

const isActiveCli = (cli: string): cli is ActiveCliId =>
  (ACTIVE_CLI_IDS as readonly string[]).includes(cli as ActiveCliId);

const ProgressRing = ({
  percent,
  size = 16,
  strokeWidth = 2,
  isGray = false,
  onClick,
}: {
  percent: number | null;
  size?: number;
  strokeWidth?: number;
  isGray?: boolean;
  onClick?: () => void;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = percent !== null ? circumference - (percent / 100) * circumference : 0;

  const getStrokeColor = () => {
    if (isGray || percent === null) {
      return 'rgb(156, 163, 175)';
    }
    if (percent >= 90) {
      return 'rgb(239, 68, 68)';
    }
    if (percent >= 70) {
      return 'rgb(251, 146, 60)';
    }
    return 'rgb(34, 197, 94)';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center transition-opacity hover:opacity-80"
      title="View usage limits"
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isGray ? 'rgb(156, 163, 175)' : 'rgb(229, 231, 235)'}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {!isGray && percent !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        )}
      </svg>
    </button>
  );
};

interface ChatInputProps {
  onSendMessage: (message: string, images?: UploadedImage[]) => void;
  disabled?: boolean;
  placeholder?: string;
  projectId?: string;
  preferredCli?: string;
  selectedModel?: string;
  modelOptions?: ModelPickerOption[];
  onModelChange?: (option: ModelPickerOption) => void;
  modelChangeDisabled?: boolean;
  cliOptions?: CliPickerOption[];
  onCliChange?: (cliId: string) => void;
  cliChangeDisabled?: boolean;
  isRunning?: boolean;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Ask Claudable...",
  projectId,
  preferredCli = 'claude',
  selectedModel: _selectedModel = '',
  modelOptions: _modelOptions = [],
  onModelChange: _onModelChange,
  modelChangeDisabled: _modelChangeDisabled = false,
  cliOptions: _cliOptions = [],
  onCliChange: _onCliChange,
  cliChangeDisabled: _cliChangeDisabled = false,
  isRunning = false
}: ChatInputProps) {
  const onCliChange = _onCliChange;
  const onModelChange = _onModelChange;
  const modelChangeDisabled = _modelChangeDisabled;
  const cliChangeDisabled = _cliChangeDisabled;
  const modelOptions = useMemo(() => _modelOptions ?? [], [_modelOptions]);
  const [message, setMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCliMenuOpen, setIsCliMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cliMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);
  const supportsImageUpload = preferredCli !== 'cursor' && preferredCli !== 'qwen' && preferredCli !== 'glm';
  const canAttachImages = useMemo(
    () => Boolean(projectId && supportsImageUpload && !disabled && !isUploading),
    [projectId, supportsImageUpload, disabled, isUploading],
  );

  // Log CLI compatibility details
  console.log('🔧 CLI Compatibility Check:', {
    preferredCli,
    supportsImageUpload,
    projectId: projectId ? 'valid' : 'missing',
    uploadButtonAvailable: supportsImageUpload && !!projectId
  });

  // Inform the user about the current state
  if (supportsImageUpload && projectId) {
    console.log('✅ Image upload is ready! Click the upload button or drag in a file.');
  } else if (!supportsImageUpload) {
    console.log('❌ The current CLI does not support image uploads. Please switch to Claude CLI.');
  } else {
    console.log('❌ Please select a project.');
  }

  const cliOptions = useMemo(() => {
    if (_cliOptions.length > 0) return _cliOptions;
    return [
      {
        id: preferredCli,
        name: ACTIVE_CLI_NAME_MAP[preferredCli as ActiveCliId] ?? preferredCli,
        available: true,
      },
    ];
  }, [_cliOptions, preferredCli]);

  const modelsForCli = useMemo(() => {
    const filtered = modelOptions.filter((option) => option.cli === preferredCli);
    return filtered.length > 0 ? filtered : modelOptions;
  }, [modelOptions, preferredCli]);

  const selectedModelValue = useMemo(() => {
    return modelOptions.some((option) => option.id === _selectedModel) ? _selectedModel : '';
  }, [modelOptions, _selectedModel]);

  const selectedModelOption = useMemo(
    () => modelsForCli.find((option) => option.id === selectedModelValue) ?? null,
    [modelsForCli, selectedModelValue],
  );

  const modelDisplayName = selectedModelOption?.name ?? (selectedModelValue || 'Select model');

  const isCliDisabled = cliChangeDisabled || !onCliChange || cliOptions.length === 0;
  const isModelDisabled = modelChangeDisabled || !onModelChange || modelsForCli.length === 0;
  const cliDisplayName =
    cliOptions.find((option) => option.id === preferredCli)?.name ??
    (isActiveCli(preferredCli) ? ACTIVE_CLI_NAME_MAP[preferredCli] : preferredCli);

  const resolvedCliId = isActiveCli(preferredCli) ? (preferredCli as ActiveCliId) : null;
  const cliBadgeLabel = resolvedCliId ? resolvedCliId.toUpperCase() : preferredCli.toUpperCase();
  const cliIconSrc = resolvedCliId ? ACTIVE_CLI_ICON_MAP[resolvedCliId] : undefined;
  const usagePercent: number | null = null;

  useEffect(() => {
    if (!isCliMenuOpen && !isModelMenuOpen && !isAddMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isCliMenuOpen && cliMenuRef.current && !cliMenuRef.current.contains(target)) {
        setIsCliMenuOpen(false);
      }
      if (isModelMenuOpen && modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setIsModelMenuOpen(false);
      }
      if (isAddMenuOpen && addMenuRef.current && !addMenuRef.current.contains(target)) {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCliMenuOpen, isModelMenuOpen, isAddMenuOpen]);

  useEffect(() => {
    setIsCliMenuOpen(false);
  }, [preferredCli]);

  useEffect(() => {
    setIsModelMenuOpen(false);
  }, [selectedModelValue, preferredCli]);

  useEffect(() => {
    if (!canAttachImages) {
      setIsAddMenuOpen(false);
    }
  }, [canAttachImages]);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Prevent multiple submissions with both state and ref locks
    if (isSubmitting || disabled || isUploading || isRunning || submissionLockRef.current) {
      return;
    }

    if (!message.trim() && uploadedImages.length === 0) {
      return;
    }

    // Set both state and ref locks immediately
    setIsSubmitting(true);
    submissionLockRef.current = true;

    try {
      // Send message and images separately - unified_manager will add image references
      onSendMessage(message.trim(), uploadedImages);
      setMessage('');
      setUploadedImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    } finally {
      // Reset submission locks after a reasonable delay
      setTimeout(() => {
        setIsSubmitting(false);
        submissionLockRef.current = false;
      }, 200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Check all locks before submitting
      if (!isSubmitting && !disabled && !isUploading && !isRunning && !submissionLockRef.current && (message.trim() || uploadedImages.length > 0)) {
        handleSubmit();
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '40px';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📸 File input change event triggered:', {
      hasFiles: !!e.target.files,
      fileCount: e.target.files?.length || 0,
      files: Array.from(e.target.files || []).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified
      }))
    });

    const files = e.target.files;
    if (!files) {
      console.log('📸 No files selected');
      return;
    }

    console.log('📸 Calling handleFiles with files');
    await handleFiles(files);
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Handle files (for both drag drop and file input)
  const handleFiles = useCallback(async (files: FileList) => {
    if (!projectId) {
      console.error('❌ No project ID available for image upload');
      alert('No project selected. Please choose a project first.');
      return;
    }

    if (!supportsImageUpload) {
      console.error('❌ Current CLI does not support image upload:', preferredCli);
      alert(`Only Claude CLI supports image uploads.\nCurrent CLI: ${preferredCli}\nSwitch to Claude CLI.`);
      return;
    }

    console.log('📸 Starting image upload process:', {
      projectId,
      cli: preferredCli,
      fileCount: files.length
    });

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
          console.warn(`⚠️ Skipping non-image file: ${file.name}, type: ${file.type}`);
          continue;
        }

        console.log(`📸 Uploading image ${i + 1}/${files.length}:`, file.name);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/assets/${projectId}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Upload failed for ${file.name}:`, response.status, errorText);
          throw new Error(`Failed to upload ${file.name}: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Image upload successful:', result);
        const imageUrl = URL.createObjectURL(file);

        const newImage: UploadedImage = {
          id: crypto.randomUUID(),
          filename: result.filename,
          path: result.absolute_path,
          url: imageUrl,
          assetUrl: `/api/assets/${projectId}/${result.filename}`,
          publicUrl: typeof result.public_url === 'string' ? result.public_url : undefined
        };

        console.log('📸 Created UploadedImage object:', newImage);
        setUploadedImages(prev => {
          const updatedImages = [...prev, newImage];
          console.log('📸 Updated uploadedImages state:', {
            totalCount: updatedImages.length,
            images: updatedImages.map(img => ({
              id: img.id,
              filename: img.filename,
              hasPath: !!img.path,
              hasAssetUrl: !!img.assetUrl,
              hasPublicUrl: !!img.publicUrl
            }))
          });
          return updatedImages;
        });
      }
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      alert('Image upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [projectId, supportsImageUpload, preferredCli]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!projectId || !supportsImageUpload) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }
      
      if (imageFiles.length > 0) {
        e.preventDefault();
        const fileList = {
          length: imageFiles.length,
          item: (index: number) => imageFiles[index],
          [Symbol.iterator]: function* () {
            for (let i = 0; i < imageFiles.length; i++) {
              yield imageFiles[i];
            }
          }
        } as FileList;
        
        // Convert to FileList-like object
        Object.defineProperty(fileList, 'length', { value: imageFiles.length });
        imageFiles.forEach((file, index) => {
          Object.defineProperty(fileList, index, { value: file });
        });
        
        handleFiles(fileList);
      }
    };
    
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [projectId, supportsImageUpload, handleFiles]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('📸 Drag enter event triggered:', { projectId, supportsImageUpload });
    if (projectId && supportsImageUpload) {
      setIsDragOver(true);
    } else {
      console.log('📸 Drag enter ignored: missing projectId or unsupported CLI');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (projectId && supportsImageUpload) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('📸 Drop event triggered:', {
      hasFiles: !!e.dataTransfer.files,
      fileCount: e.dataTransfer.files?.length || 0,
      projectId,
      supportsImageUpload,
      files: Array.from(e.dataTransfer.files || []).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    });

    if (!projectId || !supportsImageUpload) {
      console.log('📸 Drop event blocked: missing projectId or unsupported CLI');
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      console.log('📸 Calling handleFiles with dropped files');
      handleFiles(files);
    } else {
      console.log('📸 No files in drop event');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex flex-col gap-3 rounded-2xl border border-primary bg-secondary p-3 shadow-sm transition-colors ${
        isDragOver ? 'ring-2 ring-primary/30' : ''
      }`}
    >
      {isDragOver && projectId && supportsImageUpload && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-2xl bg-primary/80 text-primary backdrop-blur-sm">
          <div className="text-2xl">📸</div>
          <div className="text-sm font-semibold">Drop images to attach</div>
          <div className="text-xs text-tertiary">Supports JPG, PNG, GIF, WEBP</div>
        </div>
      )}

      {uploadedImages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {uploadedImages.map((image) => (
            <div key={image.id} className="group relative">
              <div className="h-12 w-12 overflow-hidden rounded-md border border-primary/40 bg-interactive-secondary/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.filename} className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex flex-1 items-center">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading || isSubmitting}
          className="flex w-full max-h-40 min-h-[40px] resize-none bg-transparent text-xs leading-relaxed text-primary placeholder:text-tertiary focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-1">
        <div className="relative flex items-center gap-3" ref={addMenuRef}>
          <button
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all liquid ${
              canAttachImages ? 'cursor-pointer hover:bg-interactive-hover' : 'cursor-not-allowed opacity-30'
            }`}
            title={canAttachImages ? 'Add content' : 'Add content (disabled)'}
            onClick={() => canAttachImages && setIsAddMenuOpen((prev) => !prev)}
            disabled={!canAttachImages}
          >
            <motion.div
              animate={{ rotate: isAddMenuOpen ? 45 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Plus className="h-4 w-4 text-primary" />
            </motion.div>
          </button>
          <span className="text-[11px] uppercase tracking-wide text-tertiary">{cliBadgeLabel}</span>

          <AnimatePresence>
            {isAddMenuOpen && canAttachImages && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 z-30 mb-2 w-40 overflow-hidden rounded-xl border border-primary bg-primary p-1 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsAddMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-secondary transition-colors hover:bg-interactive-hover hover:text-primary"
                >
                  <ImageIcon className="h-4 w-4 text-tertiary" />
                  Image asset
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-secondary">
          <div className="relative flex items-center gap-1.5" ref={cliMenuRef}>
            <ProgressRing
              percent={preferredCli === 'codex' ? usagePercent : null}
              size={16}
              strokeWidth={2}
              isGray={preferredCli !== 'codex'}
            />
            {cliIconSrc && (
              <NextImage src={cliIconSrc} alt={`${cliDisplayName} icon`} width={16} height={16} className="h-4 w-4 rounded-sm" />
            )}
            <button
              type="button"
              onClick={() => !isCliDisabled && setIsCliMenuOpen((prev) => !prev)}
              disabled={isCliDisabled}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                isCliDisabled ? 'cursor-not-allowed opacity-40 text-tertiary' : 'text-primary hover:text-secondary'
              }`}
            >
              <span className="max-w-[120px] truncate">{cliDisplayName}</span>
              <ChevronUp className={`h-3 w-3 transition-transform ${isCliMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isCliMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 z-30 mb-2 w-48 overflow-hidden rounded-xl border border-primary bg-primary p-1 shadow-2xl"
                >
                  <ul className="py-1">
                    {cliOptions.map((option) => {
                      const isActive = option.id === preferredCli;
                      return (
                        <li key={option.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!option.available) return;
                              onCliChange?.(option.id);
                              setIsCliMenuOpen(false);
                              requestAnimationFrame(() => textareaRef.current?.focus());
                            }}
                            disabled={!option.available}
                            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                              option.available
                                ? 'text-secondary hover:bg-interactive-hover hover:text-primary'
                                : 'cursor-not-allowed opacity-40 text-tertiary'
                            } ${isActive ? 'bg-interactive-secondary/60' : ''}`}
                          >
                            <span className="truncate">{option.name}</span>
                            {isActive && <Check className="h-3 w-3" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex items-center gap-1.5" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => !isModelDisabled && setIsModelMenuOpen((prev) => !prev)}
              disabled={isModelDisabled}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                isModelDisabled ? 'cursor-not-allowed opacity-40 text-tertiary' : 'text-primary hover:text-secondary'
              }`}
            >
              <span className="max-w-[140px] truncate">{modelDisplayName}</span>
              <ChevronUp className={`h-3 w-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isModelMenuOpen && modelsForCli.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 z-30 mb-2 w-60 overflow-hidden rounded-xl border border-primary bg-primary p-1 shadow-2xl"
                >
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {modelsForCli.map((option) => {
                      const isActive = option.id === selectedModelValue;
                      return (
                        <li key={option.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onModelChange?.(option);
                              setIsModelMenuOpen(false);
                              requestAnimationFrame(() => textareaRef.current?.focus());
                            }}
                            disabled={modelChangeDisabled}
                            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                              !modelChangeDisabled
                                ? 'text-secondary hover:bg-interactive-hover hover:text-primary'
                                : 'cursor-not-allowed opacity-40 text-tertiary'
                            } ${isActive ? 'bg-interactive-secondary/60' : ''}`}
                          >
                            <span className="truncate">{option.name}</span>
                            {isActive && <Check className="h-3 w-3" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            id="chatinput-send-message-button"
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 ease-out liquid hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              disabled ||
              isSubmitting ||
              isUploading ||
              (!message.trim() && uploadedImages.length === 0) ||
              isRunning
            }
          >
            <ArrowUp className="h-4 w-4 text-primary" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleImageUpload}
        disabled={disabled || isUploading || !projectId || !supportsImageUpload}
      />
    </form>
  );
}
