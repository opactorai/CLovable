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
  onThinkingModeChange
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || uploadedImages.length > 0) && !disabled) {
      // Send message and images separately - unified_manager will add image references
      onSendMessage(message.trim(), uploadedImages);
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
    if (!projectId || preferredCli === 'cursor' || preferredCli === 'qwen') return;
    
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
    if (projectId && preferredCli !== 'cursor' && preferredCli !== 'qwen') {
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
    if (projectId && preferredCli !== 'cursor' && preferredCli !== 'qwen') {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!projectId || preferredCli === 'cursor' || preferredCli === 'qwen') return;

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
      if (!projectId || preferredCli === 'cursor' || preferredCli === 'qwen') return;
      
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
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
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
        {isDragOver && projectId && preferredCli !== 'cursor' && preferredCli !== 'qwen' && (
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
              (preferredCli === 'cursor' || preferredCli === 'qwen') ? (
                <div 
                  className="flex items-center justify-center w-8 h-8 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50 rounded-full"
                  title={preferredCli === 'qwen' ? "Qwen Coder doesn't support image input" : "Cursor CLI doesn't support image input"}
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
            
            {/* Agent and Model Display */}
            {preferredCli && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-full">
                {/* Agent Icon */}
                <img 
                  src={preferredCli === 'claude' ? '/claude.png' : 
                       preferredCli === 'cursor' ? '/cursor.png' : 
                       preferredCli === 'qwen' ? '/qwen.png' :
                       preferredCli === 'gemini' ? '/gemini.png' :
                       '/oai.png'} 
                  alt={preferredCli}
                  className="w-4 h-4"
                />
                <span>
                  {preferredCli === 'claude' ? 'Claude Code' : 
                   preferredCli === 'cursor' ? 'Cursor Agent' : 
                   preferredCli === 'qwen' ? 'Qwen Coder' :
                   preferredCli === 'gemini' ? 'Gemini CLI' :
                   'Codex CLI'}
                </span>
                {selectedModel && (
                  <>
                    <span className="text-gray-400 dark:text-gray-600">•</span>
                    <span className="text-gray-500 dark:text-gray-500">
                      {selectedModel === 'claude-sonnet-4' ? 'Sonnet 4' : 
                       selectedModel === 'claude-opus-4.1' ? 'Opus 4.1' :
                       selectedModel === 'gpt-5' ? 'GPT-5' :
                       selectedModel === 'qwen3-coder-plus' ? 'Qwen3 Coder Plus' :
                       selectedModel === 'gemini-2.5-pro' ? 'Gemini 2.5 Pro' :
                       selectedModel === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' :
                       selectedModel}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            {/* Mode Toggle Switch */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5">
              <button
                type="button"
                onClick={() => onModeChange?.('act')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  mode === 'act'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Chat Mode: AI provides answers without modifying code"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
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
