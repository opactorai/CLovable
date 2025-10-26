"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { SendHorizontal, MessageSquare, Image as ImageIcon, Wrench } from 'lucide-react';

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

interface ChatInputProps {
  onSendMessage: (message: string, images?: UploadedImage[]) => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: 'act' | 'chat';
  onModeChange?: (mode: 'act' | 'chat') => void;
  projectId?: string;
  preferredCli?: string;
  selectedModel?: string;
  thinkingMode?: boolean;
  onThinkingModeChange?: (enabled: boolean) => void;
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
  mode = 'act',
  onModeChange,
  projectId,
  preferredCli = 'claude',
  selectedModel = '',
  thinkingMode = false,
  onThinkingModeChange,
  modelOptions = [],
  onModelChange,
  modelChangeDisabled = false,
  cliOptions = [],
  onCliChange,
  cliChangeDisabled = false,
  isRunning = false
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionLockRef = useRef(false);
  const supportsImageUpload = preferredCli !== 'cursor' && preferredCli !== 'qwen' && preferredCli !== 'glm';

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

  const modelOptionsForCli = useMemo(
    () => modelOptions.filter(option => option.cli === preferredCli),
    [modelOptions, preferredCli]
  );

  const selectedModelValue = useMemo(() => {
    return modelOptionsForCli.some(opt => opt.id === selectedModel) ? selectedModel : '';
  }, [modelOptionsForCli, selectedModel]);

  useEffect(() => {
    if (!disabled && !cliChangeDisabled && !modelChangeDisabled) {
      textareaRef.current?.focus();
    }
  }, [disabled, cliChangeDisabled, modelChangeDisabled]);

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
      className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 relative ${
      isDragOver
        ? 'border-blue-400 bg-blue-50'
        : 'border-gray-200'
    }`}
    >
      <div className="p-4 space-y-3">
        {/* Drag & Drop Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50 bg-opacity-95 rounded-2xl z-10 pointer-events-none">
            <div className="text-blue-600 text-lg font-medium mb-2">Drop images here</div>
            <div className="text-blue-500 text-sm">Drag and drop your image files</div>
            <div className="mt-4">
              <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {projectId && (
              (!supportsImageUpload) ? (
                <div
                  className="flex items-center justify-center w-8 h-8 text-gray-300 cursor-not-allowed opacity-50 rounded-full"
                  title={
                    preferredCli === 'qwen'
                      ? 'Qwen Coder does not support image input. Please use Claude CLI.'
                      : preferredCli === 'cursor'
                      ? 'Cursor CLI does not support image input. Please use Claude CLI.'
                      : 'GLM CLI supports text only. Please use Claude CLI.'
                  }
                >
                  <ImageIcon className="h-4 w-4" />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Upload images"
                  onClick={() => {
                    console.log('📸 Upload button clicked:', {
                      projectId,
                      supportsImageUpload,
                      isUploading,
                      disabled
                    });
                    if (fileInputRef.current) {
                      console.log('📸 Triggering file input click');
                      fileInputRef.current.click();
                    } else {
                      console.error('📸 fileInputRef is null');
                    }
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isUploading || disabled}
                    className="hidden"
                  />
                </div>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col text-[11px] text-gray-500 ">
              <span>Assistant</span>
              <select
                value={preferredCli}
                onChange={(e) => {
                  onCliChange?.(e.target.value);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                disabled={cliChangeDisabled || !onCliChange}
                className="mt-1 w-32 rounded-md border border-gray-300 bg-white text-gray-700 text-xs py-1 px-2 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
              >
                {cliOptions.length === 0 && <option value={preferredCli}>{preferredCli}</option>}
                {cliOptions.map(option => (
                  <option key={option.id} value={option.id} disabled={!option.available}>
                    {option.name}{!option.available ? ' (Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col text-[11px] text-gray-500 ">
              <span>Model</span>
              <select
                value={selectedModelValue}
                onChange={(e) => {
                  const option = modelOptionsForCli.find(opt => opt.id === e.target.value);
                  if (option) {
                    onModelChange?.(option);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }
                }}
                disabled={modelChangeDisabled || !onModelChange || modelOptionsForCli.length === 0}
                className="mt-1 w-40 rounded-md border border-gray-300 bg-white text-gray-700 text-xs py-1 px-2 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
              >
                {modelOptionsForCli.length === 0 && <option value="">No models available</option>}
                {modelOptionsForCli.length > 0 && selectedModelValue === '' && (
                  <option value="" disabled>Select model</option>
                )}
                {modelOptionsForCli.map(option => (
                  <option key={option.id} value={option.id} disabled={!option.available}>
                    {option.name}{!option.available ? ' (Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full ring-offset-background placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none text-[16px] leading-snug md:text-base bg-transparent focus:bg-transparent rounded-md p-2 text-gray-900 border border-gray-200 "
            id="chatinput"
            placeholder={placeholder}
            disabled={disabled || isUploading || isSubmitting}
            style={{ minHeight: '60px' }}
          />
          {isDragOver && projectId && supportsImageUpload && (
            <div className="pointer-events-none absolute inset-0 bg-blue-50/90 rounded-md flex items-center justify-center z-10 border-2 border-dashed border-blue-500">
              <div className="text-center">
                <div className="text-2xl mb-2">📸</div>
                <div className="text-sm font-medium text-blue-600 ">
                  Drop images here
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Supports: JPG, PNG, GIF, WEBP
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-gray-100 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => onModeChange?.('act')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                mode === 'act'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 '
              }`}
              title="Act Mode: AI can modify code and create/delete files"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Act</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                mode === 'chat'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 '
              }`}
              title="Chat Mode: AI provides answers without modifying code"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
          </div>

          <button
            id="chatinput-send-message-button"
            type="submit"
            className="flex size-8 items-center justify-center rounded-full bg-gray-900 text-white transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 hover:scale-110 disabled:hover:scale-100"
            disabled={disabled || isSubmitting || isUploading || (!message.trim() && uploadedImages.length === 0) || isRunning}
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Uploaded Images Preview */}
      {uploadedImages.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((image, index) => (
              <div key={image.id} className="relative group">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                  {image.filename}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} uploaded • Ready to send
          </div>
        </div>
      )}
    </form>
  );
}
