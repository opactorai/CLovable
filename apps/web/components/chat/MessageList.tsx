/**
 * Message List Component
 * Displays chat messages
 */
import React, { useState } from 'react';
import { Message } from '@/types/chat';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

// Group consecutive messages from the same role
function groupMessages(messages: Message[]): Message[][] {
  if (messages.length === 0) return [];
  
  const groups: Message[][] = [];
  let currentGroup: Message[] = [messages[0]];
  
  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];
    
    // Group if same role, same conversation, and within reasonable time
    const timeDiff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
    const shouldGroup = (
      current.role === previous.role && 
      current.conversation_id === previous.conversation_id &&
      timeDiff < 120000 // 2 minutes
    );
    
    if (shouldGroup) {
      currentGroup.push(current);
    } else {
      groups.push(currentGroup);
      currentGroup = [current];
    }
  }
  
  groups.push(currentGroup);
  return groups;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messageGroups = groupMessages(messages);
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());

  const toggleThought = (messageId: string) => {
    setExpandedThoughts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence initial={false}>
        {messageGroups.map((group, groupIndex) => {
          const firstMessage = group[0];
          const isUser = firstMessage.role === 'user';
          
          return (
            <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} key={`group-${groupIndex}-${firstMessage.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 space-y-2 ${
                  isUser
                    ? 'bg-blue-500 text-white'
                    : firstMessage.message_type === 'error'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {group.map((message, messageIndex) => {
                  // Check if this message has thinking data
                  const hasThinking = message.metadata_json?.thinking_content || message.metadata_json?.thinking_duration;
                  const thinkingDuration = message.metadata_json?.thinking_duration || 10; // Default to 10 seconds
                  const thinkingContent = message.metadata_json?.thinking_content || "Processing request...";
                  const isThoughtExpanded = expandedThoughts.has(message.id);
                  
                  return (
                  <div key={message.id || messageIndex}>
                    {/* Thinking UI for assistant messages */}
                    {!isUser && hasThinking && messageIndex === 0 && (
                      <div className="mb-2">
                        <button
                          onClick={() => toggleThought(message.id)}
                          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <svg 
                            className={`w-3 h-3 transition-transform ${isThoughtExpanded ? 'rotate-90' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-normal">Thought for {thinkingDuration} seconds</span>
                        </button>
                        
                        {isThoughtExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                              <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {thinkingContent}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                    
                    {message.message_type === 'error' && messageIndex === 0 && (
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold text-sm">Error</span>
                      </div>
                    )}
                    
                    {message.message_type === 'tool_use' ? (
                      <div className="text-sm opacity-75 italic mb-1">
                        {message.content}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                        {/* Attachments (thumbnails) */}
                        {message.metadata_json && Array.isArray((message as any).metadata_json.attachments) && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {(message as any).metadata_json.attachments.map((att: any, idx: number) => {
                              const rawUrl = att.url as string;
                              const fullUrl = rawUrl?.startsWith('http')
                                ? rawUrl
                                : `${process.env.NEXT_PUBLIC_API_BASE || ''}${rawUrl || ''}`;
                              const name = att.name || 'image';
                              return (
                                <div key={idx} className="w-20 h-20 overflow-hidden rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                                  {fullUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={fullUrl} alt={name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs opacity-60">img</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                
                {firstMessage.cli_source && (
                  <div className="mt-2 text-xs opacity-70">
                    via {firstMessage.cli_source}
                  </div>
                )}
                
                <div className="mt-1 text-xs opacity-50">
                  {new Date(group[group.length - 1].created_at).toLocaleTimeString()}
                </div>
              </div>
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
      
      {isLoading && (
        <div className="flex justify-start">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="space-y-2">
              {/* Thinking indicator */}
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-normal">Thinking...</span>
              </div>
              
              {/* Loading dots */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
                       style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
                       style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
                       style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
