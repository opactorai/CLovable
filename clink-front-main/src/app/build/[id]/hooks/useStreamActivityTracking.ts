import { useState, useCallback, useRef } from 'react';
import type {
  StreamingState,
  ActivityState,
  ActivityType,
  ToolExecution,
  ToolStatus,
  Provider,
  TurnStats,
  PlanEntry,
} from '@/types/streaming';

interface ChatEvent {
  sessionId: string;
  sequence: number;
  event: string;
  payload: {
    raw: any;
    metadata?: any;
  };
  createdAt: string;
}

export const useStreamActivityTracking = (provider: Provider) => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    thinkingBuffer: '',
    planEntries: [],
    turnComplete: false,
    turnStats: null,
    previewRefreshing: false,
    changedFiles: [],
    buildInProgress: false,
    buildSteps: [],
    devServerStatus: 'stopped',
    previewError: null,
  });

  const changedFilesRef = useRef<Set<string>>(new Set());
  const turnStartTime = useRef<number>(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track tool execution
  // Tool tracking removed - tools are now rendered directly from messages

  // Track file changes
  const addChangedFile = useCallback((filePath: string) => {
    changedFilesRef.current.add(filePath);
    setStreamingState((prev) => ({
      ...prev,
      changedFiles: Array.from(changedFilesRef.current),
    }));
  }, []);

  const clearPendingReset = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearPendingReset();
    resetTimeoutRef.current = setTimeout(() => {
      changedFilesRef.current.clear();
      turnStartTime.current = 0;
      setStreamingState((prev) => ({
        ...prev,
        thinkingBuffer: '',
        planEntries: [],
        turnComplete: false,
        previewRefreshing: false,
        changedFiles: [],
        buildInProgress: false,
        buildSteps: [],
        previewError: null,
      }));
      resetTimeoutRef.current = null;
    }, 500);
  }, [clearPendingReset]);

  // Process SSE events based on provider
  const processEvent = useCallback(
    (event: ChatEvent) => {
      const eventName = event.event;
      const raw = event.payload?.raw || event.payload;

      if (!eventName.includes('turn_end')) {
        clearPendingReset();
      }

      if (!turnStartTime.current && !eventName.includes('turn_end')) {
        turnStartTime.current = Date.now();
      }

      // Claude events
      if (provider === 'claude') {
        // System events
        if (eventName === 'claude.system.init') {
          // Session initialized - could store available tools, model info, etc.
        } else if (eventName === 'claude.system.compact_boundary') {
          // Context compaction occurred
        }

        // Stream events
        else if (eventName === 'claude.stream_event.content_block_delta') {
          const delta = raw.event?.delta;
          if (delta?.type === 'thinking_delta') {
            setStreamingState((prev) => ({
              ...prev,
              thinkingBuffer: prev.thinkingBuffer + (delta.thinking || ''),
            }));
          }
        } else if (eventName === 'claude.stream_event.content_block_start') {
          const block = raw.event?.content_block;
          if (block?.type === 'tool_use') {
            const toolName = block.name;
            const toolInput = block.input;

            // Track file changes
            if (toolName === 'Write' || toolName === 'Edit') {
              if (toolInput?.file_path) {
                addChangedFile(toolInput.file_path);
              }
            } else if (toolName === 'MultiEdit' && Array.isArray(toolInput?.edits)) {
              toolInput.edits.forEach((edit: any) => {
                if (edit.file_path) addChangedFile(edit.file_path);
              });
            }
          }
        }

        // User message (contains tool results) - skipped, handled by messages
        else if (eventName === 'claude.user') {
          // Skip - tool results are already in messages
        }

        // Result events (turn completion with stats)
        else if (eventName.startsWith('claude.result.')) {
          handleClaudeResult(raw);
        }

        // Unified turn end event
        else if (eventName === 'claude.turn_end') {
          handleTurnEnd(raw);
        }
      }

      // Codex events
      else if (provider === 'codex') {
        const msg = raw.msg;
        if (!msg) return;

        if (eventName === 'codex.agent_reasoning_delta') {
          setStreamingState((prev) => ({
            ...prev,
            thinkingBuffer: prev.thinkingBuffer + (msg.delta || ''),
          }));
        } else if (eventName === 'codex.exec_command_begin') {
          setStreamingState((prev) => ({
            ...prev,
            buildInProgress: true,
          }));
        } else if (eventName === 'codex.exec_command_end') {
          setStreamingState((prev) => ({
            ...prev,
            buildInProgress: false,
          }));
        } else if (eventName === 'codex.patch_apply_begin') {
          // Track changed files
          Object.keys(msg.changes || {}).forEach((filePath) => {
            addChangedFile(filePath);
          });
        } else if (eventName === 'codex.turn_end') {
          handleTurnEnd(raw);
        }
      }

      // Gemini events
      else if (provider === 'gemini') {
        const update = raw.update;
        if (!update) return;

        if (eventName === 'gemini.agent_thought_chunk') {
          const text = update.content?.text || '';
          setStreamingState((prev) => ({
            ...prev,
            thinkingBuffer: prev.thinkingBuffer + text,
          }));
        } else if (eventName === 'gemini.tool_call') {
          // Track changed files
          if (update.locations && Array.isArray(update.locations)) {
            update.locations.forEach((loc: any) => {
              if (loc.path) {
                addChangedFile(loc.path);
              }
            });
          }
        } else if (eventName === 'gemini.plan') {
          const entries: PlanEntry[] = (update.entries || []).map(
            (entry: any) => ({
              content: entry.content,
              priority: entry.priority || 'medium',
              status: entry.status || 'pending',
            }),
          );
          setStreamingState((prev) => ({
            ...prev,
            planEntries: entries,
          }));
        } else if (eventName === 'gemini.turn_end') {
          handleTurnEnd(raw);
        }
      }
    },
    [provider, addChangedFile, clearPendingReset],
  );

  // Handle Claude result events with detailed stats
  const handleClaudeResult = useCallback((raw: any) => {
    const duration = raw.duration_ms || (turnStartTime.current ? Date.now() - turnStartTime.current : 0);
    const success = raw.subtype === 'success' && !raw.is_error;
    const errorType = raw.subtype === 'error_max_turns' ? 'max_turns'
                    : raw.subtype === 'error_during_execution' ? 'execution'
                    : null;

    const stats: TurnStats = {
      filesModified: changedFilesRef.current.size,
      commandsExecuted: 0, // Will be counted from messages
      duration,
      cost: raw.total_cost_usd,
      success,
      usage: raw.usage,
      modelUsage: raw.modelUsage,
      numTurns: raw.num_turns,
      errorType,
    };

    setStreamingState((prev) => ({
      ...prev,
      turnComplete: true,
      turnStats: stats,
    }));

    // Reset for next turn
    turnStartTime.current = 0;
    scheduleReset();
  }, [scheduleReset]);

  // Handle turn completion (unified event)
  const handleTurnEnd = useCallback((raw: any) => {
    const duration = turnStartTime.current
      ? Date.now() - turnStartTime.current
      : 0;
    const success = raw.result === 'success' || raw.status === 'completed';

    const stats: TurnStats = {
      filesModified: changedFilesRef.current.size,
      commandsExecuted: 0, // Will be counted from messages
      duration,
      success,
    };

    setStreamingState((prev) => ({
      ...prev,
      turnComplete: true,
      turnStats: stats,
    }));

    // Reset for next turn
    turnStartTime.current = 0;
    scheduleReset();
  }, [scheduleReset]);

  // Reset state for new turn
  const resetTurn = useCallback(() => {
    changedFilesRef.current.clear();
    turnStartTime.current = 0;

    setStreamingState({
      thinkingBuffer: '',
      planEntries: [],
      turnComplete: false,
      turnStats: null,
      previewRefreshing: false,
      changedFiles: [],
      buildInProgress: false,
      buildSteps: [],
      devServerStatus: 'stopped',
      previewError: null,
    });
  }, []);

  return {
    streamingState,
    addChangedFile,
    processEvent,
    resetTurn,
  };
};
