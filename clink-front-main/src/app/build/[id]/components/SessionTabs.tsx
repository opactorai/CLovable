import { useCallback, useMemo, useState } from 'react';
import type { ChatSession, Message } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { NewChatConfirmationModal } from './NewChatConfirmationModal';
import { motion } from 'framer-motion';

type SessionTabsProps = {
  sessions: ChatSession[];
  activeChatRoomId: number | null;
  onSessionSwitch: (chatRoomId: number) => void | Promise<void>;
  onNewSession: () => void;
  onRenameSession: (chatRoomId: number, name: string) => void | Promise<void>;
  onCloseSession: (chatRoomId: number) => void | Promise<void>;
  isLoading?: boolean;
  messages: Message[];
};

const FALLBACK_PREFIX = 'Chat';
const MAX_VISIBLE_SESSIONS = 4;
const MAX_NAME_LENGTH = 25;

export function SessionTabs({
  sessions,
  activeChatRoomId,
  onSessionSwitch,
  onNewSession,
  onRenameSession,
  onCloseSession,
  isLoading = false,
  messages,
}: SessionTabsProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        // Sort by chatRoomId (highest first = most recent)
        return b.chatRoomId - a.chatRoomId;
      }),
    [sessions],
  );

  // Get full untruncated name for editing
  const getFullName = useCallback(
    (session: ChatSession) => {
      // If session has a custom name, use it
      const customName = session.name?.trim();
      if (customName && customName.length > 0) {
        return customName;
      }

      // Find first user message for this session
      const firstUserMessage = messages.find(
        (msg) => msg.role === 'user' && msg.chatRoomId === session.chatRoomId
      );

      if (firstUserMessage?.content) {
        return firstUserMessage.content.trim();
      }

      // If no message, show "New Chat"
      return 'New Chat';
    },
    [messages],
  );

  // Get truncated name for display
  const formatName = useCallback(
    (session: ChatSession) => {
      const fullName = getFullName(session);
      if (fullName.length > MAX_NAME_LENGTH) {
        return fullName.substring(0, MAX_NAME_LENGTH) + '...';
      }
      return fullName;
    },
    [getFullName],
  );

  const handleSwitch = useCallback(
    (chatRoomId: number) => {
      const result = onSessionSwitch(chatRoomId);
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>);
      }
    },
    [onSessionSwitch],
  );

  const handleRenameCommit = useCallback(
    (chatRoomId: number, name: string) => {
      const trimmed = name.trim();
      setEditingId(null);
      setDraftName('');
      if (!trimmed) {
        return;
      }
      const result = onRenameSession(chatRoomId, trimmed);
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>);
      }
    },
    [onRenameSession],
  );

  const handleNewSessionClick = useCallback(() => {
    setIsConfirmModalOpen(true);
  }, []);

  const handleConfirmNewSession = useCallback(() => {
    setIsConfirmModalOpen(false);
    onNewSession();
  }, [onNewSession]);

  const handleCancelNewSession = useCallback(() => {
    setIsConfirmModalOpen(false);
  }, []);

  return (
    <>
      <NewChatConfirmationModal
        isOpen={isConfirmModalOpen}
        onCancel={handleCancelNewSession}
        onConfirm={handleConfirmNewSession}
      />
      <div className="bg-primary/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
        {(showAllSessions ? sortedSessions : sortedSessions.slice(0, MAX_VISIBLE_SESSIONS)).map((session) => {
          const isActive = session.chatRoomId === activeChatRoomId;
          const displayName = formatName(session);
          const messageBadge = session.messageCount ?? 0;
          const isEditing = editingId === session.chatRoomId;

          return (
            <div
              key={session.chatRoomId}
              className={cn(
                'group relative flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-xs transition-colors cursor-pointer',
                isActive
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary hover:bg-elevated/60',
              )}
              onClick={() => handleSwitch(session.chatRoomId)}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg bg-interactive-secondary border border-primary"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                {isEditing ? (
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.stopPropagation();
                        handleRenameCommit(session.chatRoomId, draftName);
                      } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        setEditingId(null);
                        setDraftName('');
                      }
                    }}
                    onBlur={() => handleRenameCommit(session.chatRoomId, draftName)}
                    className="w-40 rounded bg-secondary px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditingId(session.chatRoomId);
                      setDraftName(getFullName(session));
                    }}
                  >
                    <span className="truncate max-w-[200px]">{displayName}</span>
                  </button>
                )}

                {messageBadge > 0 && !isEditing && (
                  <span className="rounded-full bg-interactive-secondary px-1.5 text-[10px] text-primary">
                    {messageBadge}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {sortedSessions.length > MAX_VISIBLE_SESSIONS && !showAllSessions && (
          <button
            type="button"
            onClick={() => setShowAllSessions(true)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-secondary transition-colors hover:text-primary hover:bg-elevated/60"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{sortedSessions.length - MAX_VISIBLE_SESSIONS} more</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleNewSessionClick}
          disabled={isLoading}
          className={cn(
            "ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors",
            isLoading
              ? "text-secondary/40 cursor-not-allowed"
              : "text-secondary hover:text-primary"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </button>
      </div>
    </div>
    </>
  );
}
