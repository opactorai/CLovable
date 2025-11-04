'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ChatSession, Message } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { NewChatConfirmationModal } from './NewChatConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

type SessionDropdownProps = {
  sessions: ChatSession[];
  activeChatRoomId: number | null;
  onSessionSwitch: (chatRoomId: number) => void | Promise<void>;
  onNewSession: () => void;
  onRenameSession: (chatRoomId: number, name: string) => void | Promise<void>;
  onCloseSession: (chatRoomId: number) => void | Promise<void>;
  isLoading?: boolean;
  messages: Message[];
  projectName?: string;
};

const MAX_NAME_LENGTH = 40;

export function SessionDropdown({
  sessions,
  activeChatRoomId,
  onSessionSwitch,
  onNewSession,
  onRenameSession,
  onCloseSession,
  isLoading = false,
  messages,
  projectName = 'Project',
}: SessionDropdownProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        return b.chatRoomId - a.chatRoomId;
      }),
    [sessions],
  );

  const getFullName = useCallback(
    (session: ChatSession) => {
      const customName = session.name?.trim();
      if (customName && customName.length > 0) {
        return customName;
      }

      const firstUserMessage = messages.find(
        (msg) => msg.role === 'user' && msg.chatRoomId === session.chatRoomId
      );

      if (firstUserMessage?.content) {
        return firstUserMessage.content.trim();
      }

      return 'New Chat';
    },
    [messages],
  );

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

  const activeSession = useMemo(
    () => sessions.find((s) => s.chatRoomId === activeChatRoomId),
    [sessions, activeChatRoomId],
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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [isNewChatHovered, setIsNewChatHovered] = useState(false);

  const dropdownRef = useCallback((node: HTMLDivElement | null) => {
    if (node && dropdownOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (!node.contains(event.target as Node)) {
          setDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <>
      <NewChatConfirmationModal
        isOpen={isConfirmModalOpen}
        onCancel={handleCancelNewSession}
        onConfirm={handleConfirmNewSession}
      />

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-secondary transition-colors"
          disabled={isLoading}
        >
          <span className="font-normal font-poppins max-w-[200px] truncate">
            {projectName || '•••'}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              dropdownOpen && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-80 bg-primary rounded-lg shadow-lg border border-primary p-1 z-50"
              onMouseLeave={() => {
                setHoveredSessionId(null);
                setIsNewChatHovered(false);
              }}
            >
              {/* Sessions List */}
              <div className="max-h-[400px] overflow-y-auto">
                {sortedSessions.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-secondary">
                    No chat sessions yet
                  </div>
                ) : (
                  <>
                    {sortedSessions.map((session) => {
                      const isActive = session.chatRoomId === activeChatRoomId;
                      const isHovered = hoveredSessionId === session.chatRoomId;
                      const shouldHighlight = (hoveredSessionId === null && !isNewChatHovered) ? isActive : isHovered;
                      const displayName = formatName(session);
                      const messageBadge = session.messageCount ?? 0;
                      const isEditing = editingId === session.chatRoomId;

                      return (
                        <div
                          key={session.chatRoomId}
                          className={cn(
                            "group relative flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded-md",
                            shouldHighlight
                              ? "text-primary font-medium bg-interactive-hover"
                              : "text-secondary"
                          )}
                          onMouseEnter={() => {
                            setHoveredSessionId(session.chatRoomId);
                            setIsNewChatHovered(false);
                          }}
                          onClick={() => {
                            if (!isEditing) {
                              handleSwitch(session.chatRoomId);
                              setDropdownOpen(false);
                            }
                          }}
                        >
                        <div className="relative z-10 flex-1 min-w-0">
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
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded bg-secondary px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary text-primary"
                              autoFocus
                            />
                          ) : (
                            <span className="text-xs truncate block">
                              {displayName}
                            </span>
                          )}
                        </div>

                        <div className="relative z-10 flex items-center gap-1.5">
                          {messageBadge > 0 && !isEditing && (
                            <span className="rounded-full bg-interactive-secondary px-1.5 text-[10px] text-primary">
                              {messageBadge}
                            </span>
                          )}

                          {/* Actions */}
                          {!isEditing && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(session.chatRoomId);
                                  setDraftName(getFullName(session));
                                }}
                                className="p-1 rounded hover:bg-elevated/60 transition-colors"
                                title="Rename"
                              >
                                <Pencil className="h-3 w-3 text-secondary" />
                              </button>
                              {sessions.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseSession(session.chatRoomId);
                                  }}
                                  className="p-1 rounded hover:bg-elevated/60 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3 text-secondary hover:text-red-500" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Divider */}
                  <div className="h-px bg-primary/10 my-1" />

                  {/* New Chat Button at Bottom */}
                  <button
                    type="button"
                    onClick={() => {
                      handleNewSessionClick();
                      setDropdownOpen(false);
                    }}
                    disabled={isLoading}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors rounded-md",
                      isNewChatHovered
                        ? "text-primary font-medium bg-interactive-hover"
                        : isLoading
                        ? "text-secondary/40 cursor-not-allowed"
                        : "text-secondary"
                    )}
                    onMouseEnter={() => {
                      setIsNewChatHovered(true);
                      setHoveredSessionId(null);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Chat</span>
                  </button>
                </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
