// Streaming activity types and state management

export type ActivityType =
  | 'thinking'
  | 'writing'
  | 'reading'
  | 'running_command'
  | 'applying_patch'
  | 'searching'
  | 'idle';

export type ToolStatus = 'pending' | 'running' | 'success' | 'failed';

export type DevServerStatus = 'live' | 'stopped' | 'error' | 'restarting';

export type Provider = 'claude' | 'codex' | 'gemini';

export interface ToolExecution {
  id: string;
  name: string;
  status: ToolStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: any;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface BuildStep {
  id: string;
  command: string;
  status: ToolStatus;
  output: string;
  error: string;
}

export interface PlanEntry {
  content: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ActivityState {
  type: ActivityType;
  message: string;
  target?: string; // file path, command, etc.
  provider: Provider;
}

export interface TurnStats {
  filesModified: number;
  commandsExecuted: number;
  duration: number;
  cost?: number;
  success: boolean;
  usage?: SDKUsage;
  modelUsage?: SDKModelUsage;
  numTurns?: number;
  errorType?: 'max_turns' | 'execution' | null;
}

export interface StreamingState {
  // Chat sidebar state
  thinkingBuffer: string;
  planEntries: PlanEntry[];
  turnComplete: boolean;
  turnStats: TurnStats | null;

  // Preview panel state
  previewRefreshing: boolean;
  changedFiles: string[];
  buildInProgress: boolean;
  buildSteps: BuildStep[];
  devServerStatus: DevServerStatus;
  previewError: Error | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens: number;
}

// Claude Agent SDK Types
export interface SDKUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface SDKModelUsage {
  [modelName: string]: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests?: number;
    costUSD: number;
    contextWindow: number;
  };
}

export interface SDKContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string | any[];
}

export interface SDKMessage {
  id?: string;
  type?: 'message';
  role: 'user' | 'assistant';
  model?: string;
  content: SDKContentBlock[];
  stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence?: string | null;
  usage?: SDKUsage;
}

export interface SDKStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  index?: number;
  message?: Partial<SDKMessage>;
  content_block?: SDKContentBlock;
  delta?: {
    type: 'text_delta' | 'thinking_delta' | 'input_json_delta';
    text?: string;
    thinking?: string;
    partial_json?: string;
    stop_reason?: string;
    stop_sequence?: string | null;
  };
  usage?: Partial<SDKUsage>;
}

export interface ClaudeSDKEventData {
  sessionId: string;
  timestamp: number;
  raw: {
    // System messages
    type?: 'system' | 'user' | 'assistant' | 'stream_event' | 'result' | 'turn_end';
    subtype?: 'init' | 'compact_boundary' | 'success' | 'error_max_turns' | 'error_during_execution';
    uuid?: string;
    session_id?: string;

    // System init fields
    apiKeySource?: 'user' | 'project' | 'org' | 'temporary';
    cwd?: string;
    tools?: string[];
    mcp_servers?: Array<{ name: string; status: string }>;
    model?: string;
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    slash_commands?: string[];
    output_style?: string;

    // Compact boundary fields
    compact_metadata?: {
      trigger: 'manual' | 'auto';
      pre_tokens: number;
    };

    // User/Assistant message fields
    parent_tool_use_id?: string | null;
    isSynthetic?: boolean;
    isReplay?: boolean;
    message?: SDKMessage;

    // Stream event fields
    event?: SDKStreamEvent;

    // Result fields
    is_error?: boolean;
    duration_ms?: number;
    duration_api_ms?: number;
    num_turns?: number;
    result?: string;
    total_cost_usd?: number;
    usage?: SDKUsage;
    modelUsage?: SDKModelUsage;
    permission_denials?: Array<{
      tool_name: string;
      tool_use_id: string;
      tool_input: any;
    }>;

    // Turn end fields (unified)
    chatId?: string;
    error_msg?: string;
  };
  metadata?: any;
}

// Event types for activity tracking
export interface ActivityEvent {
  type: 'activity_start' | 'activity_update' | 'activity_end';
  activity: ActivityState;
  timestamp: number;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_update' | 'tool_end';
  tool: ToolExecution;
  timestamp: number;
}

export interface PreviewEvent {
  type: 'preview_refresh' | 'preview_ready' | 'preview_error';
  files?: string[];
  error?: Error;
  timestamp: number;
}
