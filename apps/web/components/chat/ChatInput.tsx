"use client";

import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, MessageSquare, Image, Wrench } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface UploadedImage {
  id: string;
  filename: string;
  path: string;
  url: string;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: 'act' | 'chat';
  onModeChange?: (mode: 'act' | 'chat') => void;
  projectId?: string;
  preferredCli?: string;
  thinkingMode?: boolean;
  onThinkingModeChange?: (enabled: boolean) => void;
}

export default function ChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Ask Claudable...",
  mode = 'act',
  onModeChange,
  projectId,
  preferredCli = 'claude',
  thinkingMode = false,
  onThinkingModeChange
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || uploadedImages.length > 0) && !disabled) {
      // Add image paths to message if images are uploaded
      let finalMessage = message.trim();
      if (uploadedImages.length > 0) {
        const imagePaths = uploadedImages.map((img, index) => 
          `Image #${index + 1} path: ${img.path}`
        ).join('\n');
        finalMessage = finalMessage ? `${finalMessage}\n\n${imagePaths}` : imagePaths;
      }
      
      
      onSendMessage(finalMessage);
      setMessage('');
      setUploadedImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
    const files = e.target.files;
    if (!files) return;
    
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
  const handleFiles = async (files: FileList) => {
    if (!projectId || preferredCli === 'cursor') return;
    
    setIsUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/assets/${projectId}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Upload failed for ${file.name}:`, response.status, errorText);
          throw new Error(`Failed to upload ${file.name}: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const imageUrl = URL.createObjectURL(file);

        const newImage: UploadedImage = {
          id: crypto.randomUUID(),
          filename: result.filename,
          path: result.absolute_path,
          url: imageUrl
        };

        setUploadedImages(prev => [...prev, newImage]);
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (projectId && preferredCli !== 'cursor') {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (projectId && preferredCli !== 'cursor') {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!projectId || preferredCli === 'cursor') return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!projectId || preferredCli === 'cursor') return;
      
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
  }, [projectId, preferredCli]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.mode-dropdown-container')) {
        setShowModeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex max-h-[calc(100%-37px)] shrink-0 flex-col overflow-visible">
      <div className="relative top-6">
        <div className="[&_[data-nudge]:not(:first-child)]:hidden"></div>
      </div>
      
      {/* Image thumbnails */}
      {uploadedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 mr-2 md:mr-0">
          {uploadedImages.map((image, index) => (
            <div key={image.id} className="relative group">
              <img 
                src={image.url} 
                alt={image.filename}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg">
                Image #{index + 1}
              </div>
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <form 
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`group flex flex-col gap-2 rounded-3xl border transition-all duration-150 ease-in-out relative mr-2 md:mr-0 p-3 ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg' 
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 focus-within:shadow-lg'
        }`}
      >
        <div data-state="closed" style={{ cursor: 'text' }}>
          <div className="relative flex flex-1 items-center">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex w-full ring-offset-background placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none text-[16px] leading-snug md:text-base max-h-[200px] bg-transparent focus:bg-transparent flex-1 m-1 rounded-md p-0 text-gray-900 dark:text-gray-100"
              id="chatinput"
              placeholder={placeholder}
              disabled={disabled}
              style={{ minHeight: '40px', height: '40px' }}
            />
          </div>
        </div>
        
        {/* Drag overlay */}
        {isDragOver && projectId && preferredCli !== 'cursor' && (
          <div className="absolute inset-0 bg-blue-50/90 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center z-10 border-2 border-dashed border-blue-500">
            <div className="text-center">
              <div className="text-2xl mb-2">📸</div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Drop images here
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                Supports: JPG, PNG, GIF, WEBP
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2">
            {/* Image Upload Button */}
            {projectId && (
              preferredCli === 'cursor' ? (
                <div 
                  className="flex items-center justify-center w-8 h-8 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50 rounded-full"
                  title="Cursor CLI doesn't support image input"
                >
                  <Image className="h-4 w-4" />
                </div>
              ) : (
                <label 
                  className="flex items-center justify-center w-8 h-8 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Upload images"
                >
                  <Image className="h-4 w-4" />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isUploading || disabled}
                    className="hidden"
                  />
                </label>
              )
            )}
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            {/* Mode Selector - Similar to main page design */}
            <div className="mode-dropdown-container relative">
              <button
                type="button"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className="whitespace-nowrap text-sm font-medium transition-colors duration-100 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 shadow-sm hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 px-3 py-2 flex h-8 items-center justify-center gap-1.5 rounded-full text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white focus-visible:ring-0"
                title={mode === 'act' ? 'Act Mode: AI can modify code and create/delete files' : 'Chat Mode: AI provides answers without modifying code'}
              >
                {mode === 'act' ? <Wrench className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                <span className="text-xs">{mode === 'act' ? 'Act' : 'Chat'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 -960 960 960" className={`shrink-0 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} fill="currentColor">
                  <path d="M480-345 240-585l43-43 197 198 197-197 43 43-240 239Z"/>
                </svg>
              </button>
              
              {showModeDropdown && (
                <div className="absolute bottom-full mb-1 right-0 z-50 min-w-[150px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 backdrop-blur-xl shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onModeChange?.('act');
                      setShowModeDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/10 first:rounded-t-lg transition-colors ${
                      mode === 'act' 
                        ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5' 
                        : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title="Act Mode: AI can modify code and create/delete files directly"
                  >
                    <Wrench className="h-4 w-4" />
                    <span className="text-xs">Act</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onModeChange?.('chat');
                      setShowModeDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/10 last:rounded-b-lg transition-colors ${
                      mode === 'chat' 
                        ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5' 
                        : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title="Chat Mode: AI provides answers and explanations without modifying code"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs">Chat</span>
                  </button>
                </div>
              )}
            </div>
            
            
            {/* Send Button */}
            <button
              id="chatinput-send-message-button"
              type="submit"
              className="flex size-8 items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 hover:scale-110 disabled:hover:scale-100"
              disabled={disabled || (!message.trim() && uploadedImages.length === 0) || isUploading}
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
      
      <div className="z-10 h-2 w-full bg-background"></div>
    </div>
  );
}