/**
 * Chat Hook
 * Manages chat state and operations
 */
import { useState, useCallback, useEffect } from 'react';
import { Message, ChatSession, ActRequest, ImageAttachment } from '@/types/chat';
import { useWebSocket } from './useWebSocket';
import { useUserRequests } from './useUserRequests';

interface UseChatOptions {
  projectId: string;
  conversationId?: string;
}

export function useChat({ projectId, conversationId }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  // ★ NEW: UserRequests 상태 관리
  const {
    hasActiveRequests,
    createRequest,
    startRequest,
    completeRequest,
    getRequest
  } = useUserRequests({ projectId });

  // WebSocket connection
  const { isConnected } = useWebSocket({
    projectId,
    onMessage: (message) => {
      console.log('💬 [Chat] Adding message:', message);
      setMessages(prev => {
        // Smart message merging for better UX
        if (prev.length > 0) {
          const lastMessage = prev[prev.length - 1];
          const timeDiff = new Date(message.created_at).getTime() - new Date(lastMessage.created_at).getTime();
          
          // Merge if:
          // 1. Same role and conversation
          // 2. Within 5 seconds 
          // 3. Last message is not tool_use and current is chat
          if (
            lastMessage.role === message.role && 
            lastMessage.conversation_id === message.conversation_id &&
            timeDiff < 5000 && 
            lastMessage.message_type !== 'tool_use' &&
            message.message_type === 'chat'
          ) {
            // Merge content with current message
            const mergedMessage = {
              ...lastMessage,
              content: lastMessage.content + '\n\n' + message.content,
              created_at: message.created_at, // Use latest timestamp
              id: message.id // Use latest ID
            };
            
            console.log('💬 [Chat] Merging message with previous');
            return [...prev.slice(0, -1), mergedMessage];
          }
        }
        
        const newMessages = [...prev, message];
        console.log('💬 [Chat] Total messages:', newMessages.length);
        return newMessages;
      });
    },
    onStatus: (status, data, requestId) => {
      console.log('💬 [Chat] Status update:', status, data, requestId);
      
      // ★ NEW: request_id 기반 상태 업데이트
      if (status === 'act_start' || status === 'chat_start') {
        if (requestId) {
          startRequest(requestId);
        }
      }
      
      if (status === 'act_complete' || status === 'chat_complete') {
        if (requestId) {
          const isSuccessful = data?.status === 'completed';
          completeRequest(requestId, isSuccessful, data?.error);
        }
      }
      
      // 기존 세션 상태 업데이트
      if (data?.session_id) {
        setCurrentSession(prev => prev ? { ...prev, status: status as any } : null);
      }
    },
    onError: (error) => {
      console.log('💬 [Chat] Error:', error.message);
      setError(error.message);
    }
  });

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (conversationId) params.append('conversation_id', conversationId);
      
      const response = await fetch(
        `/api/chat/${projectId}/messages?${params.toString()}`
      );
      
      if (!response.ok) throw new Error('Failed to load messages');
      
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setError('Failed to load messages');
    }
  }, [projectId, conversationId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/chat/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          role: 'user',
          conversation_id: conversationId
        })
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      const message = await response.json();
      setMessages(prev => [...prev, message]);
      
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, conversationId]);

  // Execute Act
  const executeAct = useCallback(async (
    instruction: string,
    options?: {
      cliPreference?: string;
      fallbackEnabled?: boolean;
      images?: ImageAttachment[];
    }
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ★ NEW: request_id 생성
      const requestId = crypto.randomUUID();

      // ★ NEW: Upload images first to get server URLs and absolute paths
      let preparedImages: any[] | undefined = undefined;
      if (options?.images && options.images.length > 0) {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
        preparedImages = [];
        for (const img of options.images) {
          try {
            // If we only have a data URL, convert to Blob for upload
            let blob: Blob | null = null;
            if (img.url && img.url.startsWith('data:')) {
              const res = await fetch(img.url);
              blob = await res.blob();
            }

            // Upload via multipart/form-data
            const form = new FormData();
            if (blob) {
              const filename = img.name || 'image.png';
              form.append('file', blob, filename);
            } else {
              // If no blob (unexpected), skip this image gracefully
              continue;
            }
            const uploadResp = await fetch(`${API_BASE}/api/assets/${projectId}/upload`, {
              method: 'POST',
              body: form
            });
            if (uploadResp.ok) {
              const data = await uploadResp.json();
              // Provide absolute path for CLI to Read, and filename for display
              preparedImages.push({
                path: data.absolute_path,
                name: data.filename,
              });
            }
          } catch (e) {
            console.error('Image upload failed:', e);
          }
        }
      }
      
      const request: ActRequest = {
        instruction,
        conversation_id: conversationId,
        cli_preference: options?.cliPreference,
        fallback_enabled: options?.fallbackEnabled,
        // Send only server-side prepared images (absolute paths)
        images: preparedImages as any,
        request_id: requestId
      };
      
      const response = await fetch(`/api/chat/${projectId}/act`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) throw new Error('Failed to execute act');
      
      const result = await response.json();
      setCurrentSession(result);
      
      // ★ NEW: 요청 생성 (백엔드 응답에서 실제 생성된 메시지 ID 사용)
      // TODO: 백엔드에서 user_message_id를 응답에 포함하도록 수정 필요
      createRequest(requestId, result.session_id, instruction, 'act');
      
      return result;
    } catch (error) {
      console.error('Failed to execute act:', error);
      setError('Failed to execute act');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, conversationId, createRequest]);

  // Execute Chat (same pipeline as Act but different endpoint and event semantics)
  const executeChat = useCallback(async (
    instruction: string,
    options?: {
      cliPreference?: string;
      fallbackEnabled?: boolean;
      images?: ImageAttachment[];
    }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      // Upload images first (same as ACT)
      let preparedImages: any[] | undefined = undefined;
      if (options?.images && options.images.length > 0) {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
        preparedImages = [];
        for (const img of options.images) {
          try {
            let blob: Blob | null = null;
            if (img.url && img.url.startsWith('data:')) {
              const res = await fetch(img.url);
              blob = await res.blob();
            }
            const form = new FormData();
            if (blob) {
              const filename = img.name || 'image.png';
              form.append('file', blob, filename);
            } else {
              continue;
            }
            const uploadResp = await fetch(`${API_BASE}/api/assets/${projectId}/upload`, {
              method: 'POST',
              body: form
            });
            if (uploadResp.ok) {
              const data = await uploadResp.json();
              preparedImages.push({ path: data.absolute_path, name: data.filename });
            }
          } catch (e) {
            console.error('Image upload failed:', e);
          }
        }
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
      const response = await fetch(`${API_BASE}/api/chat/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          conversation_id: conversationId,
          cli_preference: options?.cliPreference,
          fallback_enabled: options?.fallbackEnabled,
          images: preparedImages
        })
      });

      if (!response.ok) throw new Error('Failed to execute chat');
      const result = await response.json();
      setCurrentSession(result);
      return result;
    } catch (error) {
      console.error('Failed to execute chat:', error);
      setError('Failed to execute chat');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, conversationId]);

  // Clear messages
  const clearMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (conversationId) params.append('conversation_id', conversationId);
      
      const response = await fetch(
        `/api/chat/${projectId}/messages?${params.toString()}`,
        { method: 'DELETE' }
      );
      
      if (!response.ok) throw new Error('Failed to clear messages');
      
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear messages:', error);
      setError('Failed to clear messages');
    }
  }, [projectId, conversationId]);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    error,
    isConnected,
    currentSession,
    hasActiveRequests, // ★ NEW: 활성 요청 여부
    sendMessage,
    executeAct,
    executeChat,
    clearMessages,
    loadMessages
  };
}
