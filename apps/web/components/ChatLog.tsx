"use client";
import React, { useEffect, useState, useRef, ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '../hooks/useWebSocket';
import { Brain } from 'lucide-react';
import ToolResultItem from './ToolResultItem';
import ThinkingSection from './chat/ThinkingSection';

// Tool Message Component - Enhanced with new design
const ToolMessage = ({ content, metadata }: { content: unknown; metadata?: { tool_name?: string; summary?: string; description?: string; file_path?: string; [key: string]: unknown } }) => {
  // Process tool content to extract action and file path
  const processToolContent = (rawContent: unknown) => {
    let processedContent = '' as string;
    let action: 'Edited' | 'Created' | 'Read' | 'Deleted' | 'Generated' | 'Searched' | 'Executed' = 'Executed';
    let filePath = '';
    let cleanContent: string | undefined = undefined;
    
    // Normalize content to string
    if (typeof rawContent === 'string') {
      processedContent = rawContent;
    } else if (rawContent && typeof rawContent === 'object') {
      const obj = rawContent as any;
      processedContent = obj.summary || obj.description || JSON.stringify(rawContent);
    } else {
      processedContent = String(rawContent ?? '');
    }
    
    // Clean up common artifacts
    processedContent = processedContent
      .replace(/\[object Object\]/g, '')
      .replace(/[🔧⚡🔍📖✏️📁🌐🔎🤖📝🎯✅📓⚙️🧠]/g, '')
      .trim();
    
    // Check for **Tool** pattern with path/command
    const toolMatch = processedContent.match(/\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|MultiEdit|TodoWrite)\*\*\s*`?([^`\n]+)`?/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const toolArg = toolMatch[2].trim();
      
      switch (toolName) {
        case 'Read': 
          action = 'Read';
          filePath = toolArg;
          // Don't show content for Read
          cleanContent = undefined;
          break;
        case 'Edit':
        case 'MultiEdit':
          action = 'Edited';
          filePath = toolArg;
          // Don't show content for Edit
          cleanContent = undefined;
          break;
        case 'Write': 
          action = 'Created';
          filePath = toolArg;
          cleanContent = undefined;
          break;
        case 'LS': 
          action = 'Searched';
          filePath = toolArg;
          cleanContent = undefined;
          break;
        case 'Glob':
        case 'Grep':
          action = 'Searched';
          filePath = toolArg;
          cleanContent = undefined;
          break;
        case 'Bash': 
          action = 'Executed';
          // For Bash, the argument is the command itself
          filePath = toolArg.split('\n')[0]; // Just the first line
          cleanContent = undefined;
          break;
        case 'TodoWrite':
          action = 'Generated';
          filePath = 'Todo List';
          cleanContent = undefined;
          break;
      }
      
      return { action, filePath, cleanContent, toolName };
    }
    
    // If no pattern matches, don't treat as tool message
    // Return with no file path to indicate this isn't a tool message
    return { action: 'Executed', filePath: '', cleanContent: processedContent, toolName: 'Unknown' };
  };
  
  const { action, filePath, cleanContent, toolName } = processToolContent(content);
  
  // If no file path was found, this isn't actually a tool message
  // Return null to not render anything
  if (!filePath) {
    return null;
  }
  
  // Use new ToolResultItem for clean display
  return <ToolResultItem action={action as "Edited" | "Created" | "Read" | "Deleted" | "Generated" | "Searched" | "Executed"} filePath={filePath} content={cleanContent} />;
};

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8080';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  message_type?: 'chat' | 'tool_result' | 'system' | 'error' | 'info';
  content: string;
  metadata_json?: any;
  parent_message_id?: string;
  session_id?: string;
  conversation_id?: string;
  created_at: string;
}

interface LogEntry {
  id: string;
  type: string;
  data: any;
  timestamp: string;
}

interface ActiveSession {
  status: string;
  session_id?: string;
  instruction?: string;
  started_at?: string;
  duration_seconds?: number;
}

interface ChatLogProps {
  projectId: string;
  onSessionStatusChange?: (isRunning: boolean) => void;
  onProjectStatusUpdate?: (status: string, message?: string) => void;
  startRequest?: (requestId: string) => void;
  completeRequest?: (requestId: string, isSuccessful: boolean, errorMessage?: string) => void;
}

export default function ChatLog({ projectId, onSessionStatusChange, onProjectStatusUpdate, startRequest, completeRequest }: ChatLogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use the centralized WebSocket hook
  const { isConnected } = useWebSocket({
    projectId,
    onMessage: (message) => {
      // Handle chat messages from WebSocket
      const chatMessage: ChatMessage = {
        id: message.id || `${Date.now()}-${Math.random()}`,
        role: message.role as ChatMessage['role'],
        message_type: message.message_type as ChatMessage['message_type'],
        content: message.content || '',
        metadata_json: message.metadata_json,
        parent_message_id: message.parent_message_id,
        session_id: message.session_id,
        conversation_id: message.conversation_id,
        created_at: message.created_at || new Date().toISOString()
      };
      
      // Clear waiting state when we receive an assistant message
      if (chatMessage.role === 'assistant') {
        setIsWaitingForResponse(false);
      }
      
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === chatMessage.id);
        if (exists) {
          return prev;
        }
        return [...prev, chatMessage];
      });
    },
    onStatus: (status, data) => {
      
      // Handle project status updates
      if (status === 'project_status' && data) {
        onProjectStatusUpdate?.(data.status, data.message);
      }
      
      // Handle session completion
      if (status === 'act_complete' || status === 'chat_complete') {
        setActiveSession(null);
        onSessionStatusChange?.(false);
        setIsWaitingForResponse(false); // Clear waiting state
        
        // ★ NEW: Request 완료 처리
        if (data?.request_id && completeRequest) {
          const isSuccessful = data?.status === 'completed';
          completeRequest(data.request_id, isSuccessful, data?.error);
        }
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
      
      // Handle session start
      if (status === 'act_start' || status === 'chat_start') {
        setIsWaitingForResponse(true); // Set waiting state when session starts
        
        // ★ NEW: Request 시작 처리  
        if (data?.request_id && startRequest) {
          startRequest(data.request_id);
        }
      }
    },
    onConnect: () => {
    },
    onDisconnect: () => {
    },
    onError: (error) => {
      console.error('🔌 [WebSocket] Error:', error);
    }
  });

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to detect tool usage messages based on patterns
  const isToolUsageMessage = (content: string, metadata?: any) => {
    if (!content) return false;
    
    // Check for [object Object] which indicates serialization issues with tool messages
    if (content.includes('[object Object]')) return true;
    
    // Check if metadata indicates this is a tool message
    if (metadata?.tool_name) return true;
    
    // Only match actual tool command patterns with ** markers
    const toolPatterns = [
      /\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|Task|WebFetch|WebSearch|MultiEdit|TodoWrite)\*\*/,
    ];
    
    return toolPatterns.some(pattern => pattern.test(content));
  };

  useEffect(scrollToBottom, [messages, logs]);

  // Check for active session on component mount
  const checkActiveSession = async () => {
    // NOTE: Active session endpoint doesn't exist in backend
    // Session management is handled through WebSocket
    setActiveSession(null);
    onSessionStatusChange?.(false);
    
    // Commented out problematic API call that causes 404 errors
    // try {
    //   const response = await fetch(`${API_BASE}/api/chat/${projectId}/active-session`);
    //   if (response.ok) {
    //     const sessionData: ActiveSession = await response.json();
    //     setActiveSession(sessionData);
    //     
    //     if (sessionData.status === 'active') {
    //       console.log('Found active session:', sessionData.session_id);
    //       onSessionStatusChange?.(true);
    //       
    //       // Start polling session status
    //       startSessionPolling(sessionData.session_id!);
    //     } else {
    //       onSessionStatusChange?.(false);
    //     }
    //   }
    // } catch (error) {
    //   console.error('Failed to check active session:', error);
    //   onSessionStatusChange?.(false);
    // }
  };

  // Poll session status periodically
  const startSessionPolling = (sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/chat/${projectId}/sessions/${sessionId}/status`);
        if (response.ok) {
          const sessionStatus = await response.json();
          
          if (sessionStatus.status !== 'active') {
            setActiveSession(null);
            onSessionStatusChange?.(false);
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            
            // Reload messages to get final results
            loadChatHistory();
          }
        }
      } catch (error) {
        console.error('Error polling session status:', error);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Load chat history
  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/api/chat/${projectId}/messages`);
      if (response.ok) {
        const chatMessages: ChatMessage[] = await response.json();
        setMessages(chatMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!projectId) return;
    
    let mounted = true;
    
    const loadData = async () => {
      if (mounted) {
        await loadChatHistory();
        await checkActiveSession();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [projectId]);

  // Handle log entries from other WebSocket data
  const handleWebSocketData = (data: any) => {
    // Filter out system-internal messages that shouldn't be shown to users
    const internalMessageTypes = [
      'cli_output',        // CLI execution logs
      'session_status',    // Session state updates  
      'status',            // Generic status updates
      'message',           // Already handled by onMessage
      'project_status',    // Already handled by onStatus
      'act_complete'       // Already handled by onStatus
    ];
    
    // Only add to logs if it's not an internal message type
    if (!internalMessageTypes.includes(data.type)) {
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        type: data.type,
        data: data.data || data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setLogs(prev => [...prev, logEntry]);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Function to shorten file paths
  const shortenPath = (text: string) => {
    if (!text) return text;
    
    // Pattern to match file paths (starts with / and contains multiple directories)
    const pathPattern = /\/[^\/\s]+(?:\/[^\/\s]+){3,}\/([^\/\s]+\.[^\/\s]+)/g;
    
    return text.replace(pathPattern, (match, filename) => {
      return `.../${filename}`;
    });
  };

  // Function to clean user messages by removing think hard instruction and chat mode instructions
  const cleanUserMessage = (content: string) => {
    if (!content) return content;
    
    let cleanedContent = content;
    
    // Remove think hard instruction
    cleanedContent = cleanedContent.replace(/\.\s*think\s+hard\.\s*$/, '');
    
    // Remove chat mode instruction
    cleanedContent = cleanedContent.replace(/\n\nDo not modify code, only answer to the user's request\.$/, '');
    
    return cleanedContent.trim();
  };

  // Function to render content with thinking tags
  const renderContentWithThinking = (content: string): ReactElement => {
    const parts: ReactElement[] = [];
    let lastIndex = 0;
    const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the thinking tag (with markdown)
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim();
        if (beforeText) {
          parts.push(
            <ReactMarkdown 
              key={`text-${lastIndex}`}
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                strong: ({children}) => <strong className="font-medium">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>,
                code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">{children}</code>,
                pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
                ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="mb-1 break-words">{children}</li>
              }}
            >
              {beforeText}
            </ReactMarkdown>
          );
        }
      }

      // Add the thinking section using the new component
      const thinkingText = match[1].trim();
      if (thinkingText) {
        parts.push(
          <ThinkingSection 
            key={`thinking-${match.index}`}
            content={thinkingText}
          />
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after the last thinking tag (with markdown)
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex).trim();
      if (remainingText) {
        parts.push(
          <ReactMarkdown 
            key={`text-${lastIndex}`}
            components={{
              p: ({children}) => {
                // Check for Planning tool message pattern
                const childrenArray = React.Children.toArray(children);
                const hasPlanning = childrenArray.some(child => {
                  if (typeof child === 'string' && child.includes('Planning for next moves...')) {
                    return true;
                  }
                  return false;
                });
                if (hasPlanning) {
                  return <p className="mb-2 last:mb-0 break-words">
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                      Planning for next moves...
                    </code>
                  </p>;
                }
                return <p className="mb-2 last:mb-0 break-words">{children}</p>;
              },
              strong: ({children}) => <strong className="font-medium">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">{children}</code>,
              pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
              ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({children}) => <li className="mb-1 break-words">{children}</li>
            }}
          >
            {remainingText}
          </ReactMarkdown>
        );
      }
    }

    // If no thinking tags found, return original content with markdown
    if (parts.length === 0) {
      return (
        <ReactMarkdown 
          components={{
            p: ({children}) => {
              // Check if this paragraph contains Planning tool message
              // The message now comes as plain text "Planning for next moves..."
              // ReactMarkdown passes the whole paragraph with child elements
              const childrenArray = React.Children.toArray(children);
              const hasPlanning = childrenArray.some(child => {
                if (typeof child === 'string' && child.includes('Planning for next moves...')) {
                  return true;
                }
                return false;
              });
              if (hasPlanning) {
                return <p className="mb-2 last:mb-0 break-words">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                    Planning for next moves...
                  </code>
                </p>;
              }
              return <p className="mb-2 last:mb-0 break-words">{children}</p>;
            },
            strong: ({children}) => <strong className="font-medium">{children}</strong>,
            em: ({children}) => <em className="italic">{children}</em>,
            code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">{children}</code>,
            pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            li: ({children}) => <li className="mb-1 break-words">{children}</li>
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }

    return <>{parts}</>;
  };

  // Function to get message type label and styling
  const getMessageTypeInfo = (message: ChatMessage) => {
    const { role, message_type } = message;
    
    // Handle different message types
    switch (message_type) {
      case 'tool_result':
        return {
          bgClass: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-900 dark:text-blue-100',
          labelColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'system':
        return {
          bgClass: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
          textColor: 'text-green-900 dark:text-green-100',
          labelColor: 'text-green-600 dark:text-green-400'
        };
      case 'error':
        return {
          bgClass: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
          textColor: 'text-red-900 dark:text-red-100',
          labelColor: 'text-red-600 dark:text-red-400'
        };
      case 'info':
        return {
          bgClass: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-900 dark:text-yellow-100',
          labelColor: 'text-yellow-600 dark:text-yellow-400'
        };
      default:
        // Handle by role
        switch (role) {
          case 'user':
            return {
              bgClass: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
              textColor: 'text-gray-900 dark:text-white',
              labelColor: 'text-gray-600 dark:text-gray-400'
            };
          case 'system':
            return {
              bgClass: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
              textColor: 'text-green-900 dark:text-green-100',
              labelColor: 'text-green-600 dark:text-green-400'
            };
          case 'tool':
            return {
              bgClass: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800',
              textColor: 'text-purple-900 dark:text-purple-100',
              labelColor: 'text-purple-600 dark:text-purple-400'
            };
          case 'assistant':
          default:
            return {
              bgClass: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
              textColor: 'text-gray-900 dark:text-white',
              labelColor: 'text-gray-600 dark:text-gray-400'
            };
        }
    }
  };

  // Message filtering function - hide internal tool results and system messages
  const shouldDisplayMessage = (message: ChatMessage) => {
    // Hide messages with empty or whitespace-only content
    if (!message.content || message.content.trim() === '') {
      return false;
    }
    
    // Hide tool_result messages (internal processing results)
    if (message.message_type === 'tool_result') {
      return false;
    }
    
    // Hide system initialization messages
    if (message.role === 'system' && message.message_type === 'system') {
      // Check if it's an initialization message
      if (message.content.includes('initialized') || message.content.includes('Agent')) {
        return false;
      }
    }
    
    // Hide messages explicitly marked as hidden
    if (message.metadata_json && message.metadata_json.hidden_from_ui) {
      return false;
    }
    
    // Show all other messages (user messages, assistant text responses, tool use summaries)
    return true;
  };

  const renderLogEntry = (log: LogEntry) => {
    switch (log.type) {
      case 'system':
        return (
          <div>
            System connected (Model: {log.data.model || 'Unknown'})
          </div>
        );

      case 'act_start':
        return (
          <div>
            Starting task: {shortenPath(log.data.instruction)}
          </div>
        );

      case 'text':
        return (
          <div>
            <ReactMarkdown 
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                strong: ({children}) => <strong className="font-medium">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>,
                code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono break-all">{children}</code>,
                pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
                ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="mb-1 break-words">{children}</li>
              }}
            >
              {shortenPath(log.data.content)}
            </ReactMarkdown>
          </div>
        );

      case 'thinking':
        return (
          <div className="italic">
            Thinking: {shortenPath(log.data.content)}
          </div>
        );

      case 'tool_start':
        return (
          <div>
            Using tool: {shortenPath(log.data.summary || log.data.tool_name)}
          </div>
        );

      case 'tool_result':
        const isError = log.data.is_error;
        return (
          <div>
            {shortenPath(log.data.summary)} {isError ? 'failed' : 'completed'}
          </div>
        );

      case 'result':
        return (
          <div>
            Task completed ({log.data.duration_ms}ms, {log.data.turns} turns
            {log.data.total_cost_usd && `, $${log.data.total_cost_usd.toFixed(4)}`})
          </div>
        );

      case 'act_complete':
        return (
          <div className="font-medium">
            Task completed: {shortenPath(log.data.commit_message || log.data.changes_summary)}
          </div>
        );

      case 'error':
        return (
          <div>
            Error occurred: {shortenPath(log.data.message)}
          </div>
        );

      default:
        return (
          <div>
            {log.type}: {typeof log.data === 'object' ? JSON.stringify(log.data).substring(0, 100) : String(log.data).substring(0, 100)}...
          </div>
        );
    }
  };

  const openDetailModal = (log: LogEntry) => {
    setSelectedLog(log);
  };

  const closeDetailModal = () => {
    setSelectedLog(null);
  };

  const renderDetailModal = () => {
    if (!selectedLog) return null;

    const { type, data } = selectedLog;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">로그 상세 정보</h3>
            <button
              onClick={closeDetailModal}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-gray-900 dark:text-gray-100">
              <strong className="text-gray-700 dark:text-gray-300">타입:</strong> {type}
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              <strong className="text-gray-700 dark:text-gray-300">시간:</strong> {formatTime(selectedLog.timestamp)}
            </div>

            {type === 'tool_result' && data.diff_info && (
              <div>
                <strong className="text-gray-700 dark:text-gray-300">변경 사항:</strong>
                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs font-mono">
                  {data.diff_info}
                </pre>
              </div>
            )}

            <div>
              <strong className="text-gray-700 dark:text-gray-300">상세 데이터:</strong>
              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">

      {/* 메시지와 로그를 함께 표시 */}
      <div className="flex-1 overflow-y-auto px-8 py-3 space-y-2 custom-scrollbar dark:chat-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-600 text-sm">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white mb-2 mx-auto"></div>
              <p>Loading chat history...</p>
            </div>
          </div>
        )}
        
        {!isLoading && messages.length === 0 && logs.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-600 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              <p>Start a conversation with your agent</p>
            </div>
          </div>
        )}
        
        <AnimatePresence>
          {/* Render chat messages */}
          {messages.filter(shouldDisplayMessage).map((message, index) => {
            
            return (
              <div className="mb-4" key={`message-${message.id}-${index}`}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                {message.role === 'user' ? (
                  // User message - boxed on the right
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-white break-words">
                        {(() => {
                          const cleanedMessage = cleanUserMessage(message.content);
                          
                          // Check if message contains image paths
                          const imagePattern = /Image #\d+ path: ([^\n]+)/g;
                          const imagePaths: string[] = [];
                          let match;
                          
                          while ((match = imagePattern.exec(cleanedMessage)) !== null) {
                            imagePaths.push(match[1]);
                          }
                          
                          // Remove image paths from message
                          const messageWithoutPaths = cleanedMessage.replace(/\n*Image #\d+ path: [^\n]+/g, '').trim();
                          
                          return (
                            <>
                              {messageWithoutPaths && (
                                <div>{shortenPath(messageWithoutPaths)}</div>
                              )}
                              {(() => {
                                // Use attachments from metadata if available, otherwise fallback to parsed paths
                                const attachments = message.metadata_json?.attachments || [];
                                console.log('🖼️ Message metadata:', message.metadata_json);
                                console.log('🖼️ Attachments found:', attachments);
                                if (attachments.length > 0) {
                                  return (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {attachments.map((attachment: any, idx: number) => {
                                        const imageUrl = `${API_BASE}${attachment.url}`;
                                        console.log('🔗 Image URL:', imageUrl, 'for attachment:', attachment);
                                        return (
                                        <div key={idx} className="relative group">
                                          <div className="w-40 h-40 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                                            <img 
                                              src={imageUrl}
                                              alt={`Image ${idx + 1}`}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                // Fallback to icon if image fails to load
                                                const target = e.target as HTMLImageElement;
                                                console.error('❌ Image failed to load:', target.src, 'Error:', e);
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                  parent.innerHTML = `
                                                    <div class="w-full h-full flex items-center justify-center">
                                                      <svg class="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                      </svg>
                                                    </div>
                                                  `;
                                                }
                                              }}
                                            />
                                          </div>
                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-opacity flex items-center justify-center">
                                            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded">
                                              #{idx + 1}
                                            </span>
                                          </div>
                                          {/* Tooltip with filename */}
                                          <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                            {attachment.name}
                                          </div>
                                        </div>
                                        );
                                      })}
                                    </div>
                                  );
                                } else if (imagePaths.length > 0) {
                                  // Fallback to old method for backward compatibility
                                  return (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {imagePaths.map((path, idx) => {
                                        const filename = path.split('/').pop() || 'image';
                                        return (
                                          <div key={idx} className="relative group">
                                            <div className="w-40 h-40 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                              </svg>
                                            </div>
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-opacity flex items-center justify-center">
                                              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded">
                                                #{idx + 1}
                                              </span>
                                            </div>
                                            {/* Tooltip with filename */}
                                            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                              {filename}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Agent message - full width, no box
                  <div className="w-full">
                    {isToolUsageMessage(message.content, message.metadata_json) ? (
                      // Tool usage - clean display with expand functionality
                      <ToolMessage content={message.content} metadata={message.metadata_json} />
                    ) : (
                      // Regular agent message - plain text
                      <div className="text-sm text-gray-900 dark:text-white leading-relaxed">
                        {renderContentWithThinking(shortenPath(message.content))}
                      </div>
                    )}
                  </div>
                )}
                </motion.div>
              </div>
            );
          })}
          
          {/* Render filtered agent logs as plain text */}
          {logs.filter(log => {
            // Hide internal tool results and system logs
            const hideTypes = ['tool_result', 'tool_start', 'system'];
            return !hideTypes.includes(log.type);
          }).map((log, index) => (
            <div key={`log-${log.id}-${index}`} className="mb-4 w-full cursor-pointer" onClick={() => openDetailModal(log)}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="text-sm text-gray-900 dark:text-white leading-relaxed">
                  {renderLogEntry(log)}
                </div>
              </motion.div>
            </div>
          ))}
        </AnimatePresence>
        
        {/* Loading indicator for waiting response */}
        {isWaitingForResponse && (
          <div className="mb-4 w-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-xl text-gray-900 dark:text-white leading-relaxed font-bold">
                <span className="animate-pulse">...</span>
              </div>
            </motion.div>
          </div>
        )}
        
        <div ref={logsEndRef} />
      </div>

      {/* 상세 모달 */}
      <AnimatePresence>
        {selectedLog && renderDetailModal()}
      </AnimatePresence>
    </div>
  );
}