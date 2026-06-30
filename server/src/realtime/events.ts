/**
 * Normalized realtime event vocabulary streamed to the browser.
 * Both the WebSocket and SSE transports carry these identical payloads.
 */

export type ToolAction =
  | 'Read'
  | 'Created'
  | 'Edited'
  | 'Deleted'
  | 'Generated'
  | 'Searched'
  | 'Executed';

export interface RealtimeEnvelope<T = unknown> {
  /** event type discriminator */
  type: string;
  /** project this event belongs to */
  projectId: string;
  /** request that produced this event (when applicable) */
  requestId?: string;
  /** monotonically increasing per-connection sequence (added at send time) */
  seq?: number;
  /** ISO timestamp */
  ts: string;
  data: T;
}

/** Connection acknowledgement sent immediately on WS open. */
export interface ConnectedEvent {
  transport: 'websocket';
  stage: 'handshake';
}

/** A persisted chat message (user/assistant/system/tool). */
export interface MessageEvent {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
}

/** Streaming token delta for an in-progress assistant message. */
export interface AssistantDeltaEvent {
  text: string;
}

/** A tool invocation (file edit, shell command, search, etc.). */
export interface ToolEvent {
  toolName: string;
  action?: ToolAction;
  filePath?: string;
  command?: string;
  summary?: string;
  phase: 'start' | 'result';
  output?: string;
}

/** Raw terminal / build output line. */
export interface TerminalEvent {
  stream: 'stdout' | 'stderr';
  line: string;
}

/** Lifecycle / status change for the project or run. */
export interface StatusEvent {
  status: string;
  detail?: string;
}

/** Run finished (success or failure). */
export interface CompletionEvent {
  ok: boolean;
  durationMs?: number;
  error?: string;
}

export type AnyRealtimeEvent =
  | RealtimeEnvelope<ConnectedEvent>
  | RealtimeEnvelope<MessageEvent>
  | RealtimeEnvelope<AssistantDeltaEvent>
  | RealtimeEnvelope<ToolEvent>
  | RealtimeEnvelope<TerminalEvent>
  | RealtimeEnvelope<StatusEvent>
  | RealtimeEnvelope<CompletionEvent>;

/** Helper to build a well-formed envelope. */
export function makeEvent<T>(
  type: string,
  projectId: string,
  data: T,
  opts: { requestId?: string } = {},
): RealtimeEnvelope<T> {
  return {
    type,
    projectId,
    requestId: opts.requestId,
    ts: new Date().toISOString(),
    data,
  };
}
