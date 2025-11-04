# Claude Agent SDK SSE Event Reference

Claude Agent SDK (v0.1.0+) 어댑터가 Chat SSE를 통해 전달하는 이벤트들을 정리합니다. 모든 이벤트는 통일된 구조를 가지며, `data.raw`에는 SDK JSONL 원본이 포함됩니다.

> **Migration Note**: 이 문서는 `@anthropic-ai/claude-agent-sdk` v0.1.0+ 기준입니다. 이전 `@anthropic-ai/claude-code` 패키지와는 타입 구조가 다릅니다.

## 공통 SSE 구조

```javascript
{
  event: "claude.*",  // 이벤트 이름
  data: {
    sessionId: "sess_...",     // Claude 세션 ID
    timestamp: 1736940000000,  // 서버 타임스탬프 (ms)
    raw: { ... },              // Claude CLI 원본 JSONL 메시지
    metadata: {
      provider: "claude",
      chatId: "...",
      claudeSessionId: "...",
      originalEvent: { ... },  // raw와 동일
      ...                      // 추가 메타데이터
    }
  }
}
```

## SDK Message Types

Agent SDK는 다음과 같은 메시지 타입을 제공합니다:

```typescript
type SDKMessage =
  | SDKSystemMessage          // type: 'system', subtype: 'init' | 'compact_boundary'
  | SDKUserMessage            // type: 'user'
  | SDKUserMessageReplay      // type: 'user', isReplay: true
  | SDKAssistantMessage       // type: 'assistant'
  | SDKPartialAssistantMessage // type: 'stream_event'
  | SDKResultMessage          // type: 'result', subtype: 'success' | 'error_*'
```

모든 메시지는 `uuid`(필수)와 `session_id`(필수) 필드를 포함합니다.

## Event 목록

| SSE Event | 발생 시점 | `data.raw.type` | `data.raw.subtype` |
|-----------|----------|-----------------|-------------------|
| `claude.session_start` | 새 Claude 세션 시작 | (custom) | - |
| `claude.system.init` | 세션 초기화 완료 | `system` | `init` |
| `claude.system.compact_boundary` | 컨텍스트 압축 발생 | `system` | `compact_boundary` |
| `claude.system` | 기타 시스템 메시지 | `system` | (varies) |
| `claude.user` | 사용자 입력 또는 tool result | `user` | - |
| `claude.assistant` | Claude 최종 응답 | `assistant` | - |
| `claude.stream_event.message_start` | 응답 메시지 시작 | `stream_event` | - |
| `claude.stream_event.content_block_start` | Content block 시작 | `stream_event` | - |
| `claude.stream_event.content_block_delta` | Content 스트리밍 | `stream_event` | - |
| `claude.stream_event.content_block_stop` | Content block 종료 | `stream_event` | - |
| `claude.stream_event.message_delta` | 메시지 메타데이터 업데이트 | `stream_event` | - |
| `claude.stream_event.message_stop` | 응답 메시지 종료 | `stream_event` | - |
| `claude.result.success` | **턴 완료 - 성공** | `result` | `success` |
| `claude.result.error_max_turns` | **턴 완료 - 최대 턴 초과** | `result` | `error_max_turns` |
| `claude.result.error_during_execution` | **턴 완료 - 실행 중 에러** | `result` | `error_during_execution` |
| `claude.turn_end` | **통합 턴 완료 이벤트** | (unified format) | - |
| `claude.error` | 에러 발생 | (error) | - |

## 1. Session 관리

### `claude.session_start`
세션이 시작되었음을 알리는 커스텀 이벤트입니다.
```javascript
{
  event: "claude.session_start",
  data: {
    raw: {
      type: "session_start",
      session_id: "sess_abc123",
      message: "Claude session started (Claude ID: sess_abc123)"
    }
  }
}
```

### `claude.system.init` (SDKSystemMessage)
세션 초기화가 완료되었을 때 발생합니다. 사용 가능한 도구, MCP 서버, 모델 정보 등이 포함됩니다.

```javascript
{
  event: "claude.system.init",
  data: {
    raw: {
      type: "system",
      subtype: "init",
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      session_id: "sess_abc123",
      apiKeySource: "user",  // "user" | "project" | "org" | "temporary"
      cwd: "/workspace",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "Task", ...],
      mcp_servers: [
        { name: "filesystem", status: "connected" },
        { name: "github", status: "connected" }
      ],
      model: "claude-sonnet-4-5-20250929",
      permissionMode: "bypassPermissions",  // "default" | "acceptEdits" | "bypassPermissions" | "plan"
      slash_commands: ["help", "clear", "compact", ...],
      output_style: "default"
    }
  }
}
```

### `claude.system.compact_boundary` (SDKCompactBoundaryMessage)
컨텍스트 압축(compaction)이 발생했을 때 알립니다.

```javascript
{
  event: "claude.system.compact_boundary",
  data: {
    raw: {
      type: "system",
      subtype: "compact_boundary",
      uuid: "550e8400-e29b-41d4-a716-446655440001",
      session_id: "sess_abc123",
      compact_metadata: {
        trigger: "auto",  // "manual" | "auto"
        pre_tokens: 150000  // 압축 전 토큰 수
      }
    }
  }
}
```

### `claude.system`
기타 시스템 메시지 (일반적인 상태 업데이트)
```javascript
{
  event: "claude.system",
  data: {
    raw: {
      type: "system",
      // 기타 시스템 정보
    }
  }
}
```

## 2. Assistant 응답

### `claude.assistant` (SDKAssistantMessage)
Claude의 최종 완성된 응답입니다. Streaming이 끝난 후 전체 메시지가 전달됩니다.

```javascript
{
  event: "claude.assistant",
  data: {
    raw: {
      type: "assistant",
      uuid: "550e8400-e29b-41d4-a716-446655440002",
      session_id: "sess_abc123",
      parent_tool_use_id: null,  // tool 내부 응답인 경우 부모 tool ID
      message: {
        id: "msg_xyz",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-5-20250929",
        content: [
          {
            type: "text",
            text: "Here's the solution..."
          },
          {
            type: "thinking",
            thinking: "Let me analyze this step by step...",
            signature: "sig_abc123"  // optional
          },
          {
            type: "tool_use",
            id: "toolu_abc",
            name: "Read",
            input: { file_path: "/path/to/file.py" }
          }
        ],
        stop_reason: "end_turn",  // "end_turn" | "max_tokens" | "stop_sequence" | null
        stop_sequence: null,
        usage: {
          input_tokens: 150,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 100
        }
      }
    }
  }
}
```

### `claude.stream_event.*` (SDKPartialAssistantMessage)
Claude streaming 중간 이벤트들입니다. 실시간으로 응답을 스트리밍합니다.

```javascript
{
  event: "claude.stream_event.content_block_start",
  data: {
    raw: {
      type: "stream_event",
      uuid: "550e8400-e29b-41d4-a716-446655440003",
      session_id: "sess_abc123",
      parent_tool_use_id: null,
      event: {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "thinking",  // "thinking" | "text" | "tool_use"
          thinking: ""       // 초기값 (thinking인 경우)
          // or
          // text: ""        // 초기값 (text인 경우)
          // or
          // id: "toolu_xyz",
          // name: "Bash",
          // input: {}        // 초기값 (tool_use인 경우)
        }
      }
    }
  }
}
```

**주요 stream event types:**

1. **`message_start`**: 응답 메시지가 시작될 때
   ```javascript
   {
     event: { type: "message_start", message: { id: "msg_...", role: "assistant", ... } }
   }
   ```

2. **`content_block_start`**: thinking/text/tool_use 블록 시작
   ```javascript
   {
     event: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }
   }
   ```

3. **`content_block_delta`**: 텍스트/thinking/tool arguments 스트리밍
   ```javascript
   {
     event: {
       type: "content_block_delta",
       index: 0,
       delta: {
         type: "text_delta",      // "text_delta" | "thinking_delta" | "input_json_delta"
         text: "Here is the"      // 스트리밍되는 텍스트 조각
       }
     }
   }
   ```

4. **`content_block_stop`**: 블록 완료
   ```javascript
   {
     event: { type: "content_block_stop", index: 0 }
   }
   ```

5. **`message_delta`**: 메타데이터 업데이트 (stop_reason, usage 등)
   ```javascript
   {
     event: {
       type: "message_delta",
       delta: { stop_reason: "end_turn", stop_sequence: null },
       usage: { output_tokens: 250 }
     }
   }
   ```

6. **`message_stop`**: 응답 완료
   ```javascript
   {
     event: { type: "message_stop" }
   }
   ```

## 3. User 입력 및 Tool Results

### `claude.user` (SDKUserMessage)
사용자의 직접 입력 또는 Tool 실행 결과를 포함합니다.

```javascript
{
  event: "claude.user",
  data: {
    raw: {
      type: "user",
      uuid: "550e8400-e29b-41d4-a716-446655440004",  // optional (새 메시지인 경우)
      session_id: "sess_abc123",
      parent_tool_use_id: "toolu_abc",  // tool result인 경우, null이면 사용자 입력
      isSynthetic: false,  // true면 시스템이 생성한 메시지
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please read this file"
          }
          // or
          {
            type: "tool_result",
            tool_use_id: "toolu_abc",
            content: "File contents here..."
            // or content: [{ type: "text", text: "..." }, { type: "image", source: {...} }]
          }
        ]
      }
    }
  }
}
```

### SDKUserMessageReplay
이미 추가된 사용자 메시지의 재전송/확인입니다. `isReplay: true`로 구분됩니다.

```javascript
{
  event: "claude.user",
  data: {
    raw: {
      type: "user",
      uuid: "550e8400-e29b-41d4-a716-446655440004",  // 필수
      session_id: "sess_abc123",
      isReplay: true,  // 이미 처리된 메시지임을 표시
      message: { ... }
    }
  }
}
```

## 4. 턴 완료

### `claude.result.*` (SDKResultMessage)
**중요**: 한 턴의 작업이 완료되었음을 알리는 이벤트입니다. `subtype`에 따라 성공/실패가 구분됩니다.

#### `claude.result.success` (성공)
```javascript
{
  event: "claude.result.success",
  data: {
    raw: {
      type: "result",
      subtype: "success",
      uuid: "550e8400-e29b-41d4-a716-446655440005",
      session_id: "sess_abc123",
      is_error: false,
      duration_ms: 5432,
      duration_api_ms: 5123,
      num_turns: 3,
      result: "Task completed successfully",  // 성공 시에만 포함
      total_cost_usd: 0.0123,
      usage: {
        input_tokens: 1234,
        output_tokens: 567,
        cache_read_input_tokens: 890,
        cache_creation_input_tokens: 0
      },
      modelUsage: {
        "claude-sonnet-4-5-20250929": {
          inputTokens: 1234,
          outputTokens: 567,
          cacheReadInputTokens: 890,
          cacheCreationInputTokens: 0,
          webSearchRequests: 0,
          costUSD: 0.0123,
          contextWindow: 200000
        }
      },
      permission_denials: []
    }
  }
}
```

#### `claude.result.error_max_turns` (최대 턴 초과)
```javascript
{
  event: "claude.result.error_max_turns",
  data: {
    raw: {
      type: "result",
      subtype: "error_max_turns",
      uuid: "550e8400-e29b-41d4-a716-446655440006",
      session_id: "sess_abc123",
      is_error: true,
      duration_ms: 12000,
      duration_api_ms: 11500,
      num_turns: 25,  // maxTurns에 도달
      total_cost_usd: 0.0456,
      usage: { ... },
      modelUsage: { ... },
      permission_denials: []
    }
  }
}
```

#### `claude.result.error_during_execution` (실행 중 에러)
```javascript
{
  event: "claude.result.error_during_execution",
  data: {
    raw: {
      type: "result",
      subtype: "error_during_execution",
      uuid: "550e8400-e29b-41d4-a716-446655440007",
      session_id: "sess_abc123",
      is_error: true,
      duration_ms: 3000,
      duration_api_ms: 2500,
      num_turns: 2,
      total_cost_usd: 0.0089,
      usage: { ... },
      modelUsage: { ... },
      permission_denials: []
    }
  }
}
```

**성공/실패 판단:**
- `subtype === "success"` → 성공
- `subtype === "error_max_turns"` → 최대 턴 수 초과로 실패
- `subtype === "error_during_execution"` → 실행 중 에러로 실패
- `is_error === true` → 실패

**주요 필드:**
- `duration_ms`: 전체 소요 시간 (밀리초)
- `duration_api_ms`: API 호출 소요 시간 (밀리초)
- `num_turns`: 총 턴 수
- `result`: 성공 메시지 (성공 시에만 포함)
- `total_cost_usd`: 총 비용 (USD)
- `usage`: 전체 토큰 사용량
- `modelUsage`: 모델별 상세 사용량
- `permission_denials`: 거부된 권한 요청 목록

### `claude.turn_end`
**통합 턴 완료 이벤트**: 모든 CLI에서 동일한 형식으로 턴 완료를 알립니다.

```javascript
{
  event: "claude.turn_end",
  data: {
    raw: {
      type: "turn_end",
      chatId: "chat_abc123",
      sessionId: "sess_abc123",
      result: "success",  // "success" or "fail"
      error_msg: undefined  // 실패 시에만 포함
    }
  }
}
```

**권장**: 클라이언트는 `claude.turn_end`를 사용하여 턴 완료를 감지하는 것이 좋습니다. 모든 CLI에서 동일한 형식을 사용합니다.

## 5. Error 처리

### `claude.error`
```javascript
{
  event: "claude.error",
  data: {
    raw: {
      type: "system",
      subtype: "error",
      session_id: "sess_abc123",
      error: "Error message",
      // 에러 세부사항
    }
  }
}
```

## 클라이언트 파싱 가이드

### 0. 턴 완료 감지
**권장**: 통합 `turn_end` 이벤트 사용

```javascript
// 통합 방식 (권장) - 모든 CLI에서 동일한 패턴
function isTurnComplete(event) {
  return event.event === 'claude.turn_end';
}

function isTurnSuccess(event) {
  return event.event === 'claude.turn_end' && event.data.raw.result === 'success';
}

// 사용 예시
eventSource.addEventListener('message', (e) => {
  const event = JSON.parse(e.data);

  if (isTurnComplete(event)) {
    const data = event.data.raw;
    console.log('Turn completed!');
    console.log('Chat ID:', data.chatId);
    console.log('Session ID:', data.sessionId);
    console.log('Result:', data.result);
    if (data.error_msg) {
      console.error('Error:', data.error_msg);
    }
  }
});

// SDK 방식 (claude.result.* 직접 사용)
function isTurnCompleteSDK(event) {
  return event.event.startsWith('claude.result.');
}

function isTurnSuccessSDK(event) {
  return event.event === 'claude.result.success';
}

function isTurnErrorMaxTurns(event) {
  return event.event === 'claude.result.error_max_turns';
}

function isTurnErrorDuringExecution(event) {
  return event.event === 'claude.result.error_during_execution';
}
```

### 1. Thinking 추출
```javascript
function parseThinking(events) {
  return events
    .filter(e => e.event === 'claude.stream_event.content_block_delta')
    .filter(e => e.data.raw.event?.delta?.type === 'thinking_delta')
    .map(e => e.data.raw.event.delta.thinking)
    .join('');
}
```

### 2. Assistant 텍스트 추출
```javascript
function parseAssistantText(events) {
  // 스트리밍 델타에서 추출
  const streamText = events
    .filter(e => e.event === 'claude.stream_event.content_block_delta')
    .filter(e => e.data.raw.event?.delta?.type === 'text_delta')
    .map(e => e.data.raw.event.delta.text)
    .join('');

  // 또는 최종 메시지에서 추출
  const finalEvent = events.find(e => e.event === 'claude.assistant');
  const finalText = finalEvent?.data.raw.message?.content
    ?.filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return finalText || streamText;
}
```

### 3. Tool Calls 추출
```javascript
function parseToolCalls(events) {
  const toolCalls = [];

  // assistant 메시지에서 tool_use 블록 찾기
  events
    .filter(e => e.event === 'claude.assistant')
    .forEach(event => {
      const content = event.data.raw.message?.content || [];
      content
        .filter(block => block.type === 'tool_use')
        .forEach(tool => {
          toolCalls.push({
            id: tool.id,
            name: tool.name,
            arguments: tool.input
          });
        });
    });

  return toolCalls;
}
```

### 4. Tool Results 추출
```javascript
function parseToolResults(events) {
  const results = [];

  events
    .filter(e => e.event === 'claude.user')
    .forEach(event => {
      const content = event.data.raw.message?.content || [];
      content
        .filter(block => block.type === 'tool_result')
        .forEach(result => {
          results.push({
            toolUseId: result.tool_use_id,
            content: result.content
          });
        });
    });

  return results;
}
```

### 5. 통합 파서 예시
```javascript
class ClaudeEventParser {
  constructor() {
    this.events = [];
    this.thinking = '';
    this.assistantText = '';
    this.toolCalls = [];
    this.toolResults = [];
    this.turnComplete = false;
    this.turnSuccess = false;
    this.usage = null;
    this.modelUsage = null;
  }

  addEvent(sseEvent) {
    this.events.push(sseEvent);
    this.processEvent(sseEvent);
  }

  processEvent(event) {
    const raw = event.data.raw;

    switch (event.event) {
      case 'claude.stream_event.content_block_delta':
        const delta = raw.event?.delta;
        if (delta?.type === 'thinking_delta') {
          this.thinking += delta.thinking;
        } else if (delta?.type === 'text_delta') {
          this.assistantText += delta.text;
        }
        break;

      case 'claude.assistant':
        // 최종 응답에서 tool calls 추출
        const content = raw.message?.content || [];
        content
          .filter(block => block.type === 'tool_use')
          .forEach(tool => {
            this.toolCalls.push({
              id: tool.id,
              name: tool.name,
              arguments: tool.input
            });
          });
        break;

      case 'claude.user':
        // tool results 추출
        const userContent = raw.message?.content || [];
        userContent
          .filter(block => block.type === 'tool_result')
          .forEach(result => {
            this.toolResults.push({
              toolUseId: result.tool_use_id,
              content: result.content
            });
          });
        break;

      case 'claude.result.success':
      case 'claude.result.error_max_turns':
      case 'claude.result.error_during_execution':
        // 턴 완료 처리
        this.turnComplete = true;
        this.turnSuccess = raw.subtype === 'success' && !raw.is_error;
        this.usage = raw.usage;
        this.modelUsage = raw.modelUsage;
        break;
    }
  }
}
```

이 구조를 통해 Claude Agent SDK의 모든 스트리밍 이벤트를 안정적으로 파싱할 수 있습니다.

## 6. Tool Input Types

Agent SDK는 다양한 도구의 입력 스키마를 정의합니다. 각 도구는 특정 타입의 `input` 객체를 받습니다.

### 파일 작업 도구

#### Read
파일을 읽습니다.
```typescript
{
  file_path: string;      // 절대 경로
  offset?: number;        // 시작 라인 번호 (선택)
  limit?: number;         // 읽을 라인 수 (선택)
}
```

#### Write
파일을 작성하거나 덮어씁니다.
```typescript
{
  file_path: string;      // 절대 경로
  content: string;        // 파일 내용
}
```

#### Edit
파일의 특정 부분을 수정합니다.
```typescript
{
  file_path: string;      // 절대 경로
  old_string: string;     // 교체할 텍스트
  new_string: string;     // 새 텍스트
  replace_all?: boolean;  // 모든 발생을 교체 (기본: false)
}
```

#### MultiEdit
여러 파일을 한 번에 수정합니다.
```typescript
{
  edits: Array<{
    file_path: string;      // 절대 경로
    old_string: string;     // 교체할 텍스트
    new_string: string;     // 새 텍스트
    replace_all?: boolean;  // 모든 발생을 교체 (기본: false)
  }>;
}
```

#### Glob
파일 패턴 매칭으로 파일을 찾습니다.
```typescript
{
  pattern: string;        // glob 패턴 (예: "**/*.ts")
  path?: string;          // 검색할 디렉토리 (선택)
}
```

#### Grep
파일 내용을 검색합니다.
```typescript
{
  pattern: string;              // 정규식 패턴
  path?: string;                // 검색 경로
  glob?: string;                // 파일 필터 (예: "*.js")
  type?: string;                // 파일 타입 (예: "js", "py")
  output_mode?: string;         // "content" | "files_with_matches" | "count"
  "-i"?: boolean;               // 대소문자 무시
  "-n"?: boolean;               // 라인 번호 표시
  "-A"?: number;                // 이후 N줄 표시
  "-B"?: number;                // 이전 N줄 표시
  "-C"?: number;                // 전후 N줄 표시
  multiline?: boolean;          // 멀티라인 모드
  head_limit?: number;          // 출력 제한
}
```

### 실행 도구

#### Bash
Shell 명령을 실행합니다.
```typescript
{
  command: string;              // 실행할 명령
  description?: string;         // 명령 설명 (5-10 단어)
  timeout?: number;             // 타임아웃 (ms, 최대 600000)
  run_in_background?: boolean;  // 백그라운드 실행
}
```

#### BashOutput
백그라운드 Shell의 출력을 가져옵니다.
```typescript
{
  bash_id: string;        // Shell ID
  filter?: string;        // 정규식 필터 (선택)
}
```

#### KillShell
백그라운드 Shell을 종료합니다.
```typescript
{
  shell_id: string;       // Shell ID
}
```

### 웹 도구

#### WebSearch
웹 검색을 수행합니다.
```typescript
{
  query: string;                // 검색 쿼리
  allowed_domains?: string[];   // 허용할 도메인
  blocked_domains?: string[];   // 차단할 도메인
}
```

#### WebFetch
웹 페이지를 가져옵니다.
```typescript
{
  url: string;            // 가져올 URL
  prompt: string;         // 처리할 프롬프트
}
```

### Agent 도구

#### Task
서브 에이전트를 실행합니다.
```typescript
{
  description: string;    // 짧은 작업 설명 (3-5 단어)
  prompt: string;         // 상세 작업 지시
  subagent_type: string;  // 에이전트 타입 ("general-purpose" 등)
}
```

#### TodoWrite
작업 목록을 관리합니다.
```typescript
{
  todos: Array<{
    content: string;      // 작업 내용 (명령형)
    status: "pending" | "in_progress" | "completed";
    activeForm: string;   // 진행형 표시 (예: "Running tests")
  }>;
}
```

#### ExitPlanMode
Plan 모드를 종료합니다.
```typescript
{
  plan: string;           // 계획 내용 (마크다운 지원)
}
```

### Jupyter 도구

#### NotebookEdit
Jupyter 노트북 셀을 편집합니다.
```typescript
{
  notebook_path: string;        // 노트북 절대 경로
  new_source: string;           // 셀 내용
  cell_id?: string;             // 셀 ID (선택)
  cell_type?: "code" | "markdown";  // 셀 타입
  edit_mode?: "replace" | "insert" | "delete";  // 편집 모드
}
```

### IDE 통합 도구 (MCP)

#### mcp__ide__getDiagnostics
VS Code 진단 정보를 가져옵니다.
```typescript
{
  uri?: string;           // 파일 URI (선택, 없으면 전체)
}
```

#### mcp__ide__executeCode
Jupyter 커널에서 코드를 실행합니다.
```typescript
{
  code: string;           // 실행할 코드
}
```

### MCP 도구

#### ListMcpResources
MCP 서버의 리소스 목록을 가져옵니다.
```typescript
{
  server?: string;        // 서버 이름 (선택, 없으면 전체)
}
```

#### ReadMcpResource
MCP 리소스를 읽습니다.
```typescript
{
  server: string;         // 서버 이름
  uri: string;            // 리소스 URI
}
```

### Slash Commands

Slash commands는 `/` 로 시작하는 특수 명령입니다:

- `/help` - 도움말 표시
- `/clear` - 대화 기록 초기화
- `/compact` - 수동 컨텍스트 압축
- `/review-pr <number>` - GitHub PR 리뷰 (GitHub MCP 서버 필요)

## 7. Permission Management

Agent SDK는 세밀한 권한 관리를 제공합니다.

### Permission Modes

```typescript
type PermissionMode =
  | "default"             // 기본 (사용자에게 물어봄)
  | "acceptEdits"         // 파일 편집 자동 승인
  | "bypassPermissions"   // 모든 권한 자동 승인
  | "plan";               // Plan 모드 (실행하지 않음)
```

### Permission Denials

권한이 거부된 도구 사용은 `SDKResultMessage`의 `permission_denials`에 기록됩니다:

```typescript
{
  permission_denials: [
    {
      tool_name: "Bash",
      tool_use_id: "toolu_xyz",
      tool_input: { command: "rm -rf /" }
    }
  ]
}
```

## 8. Model Usage Tracking

Agent SDK는 모델별 상세 사용량을 추적합니다.

```typescript
{
  modelUsage: {
    "claude-sonnet-4-20250514": {
      inputTokens: 1234,
      outputTokens: 567,
      cacheReadInputTokens: 890,
      cacheCreationInputTokens: 0,
      webSearchRequests: 2,
      costUSD: 0.0123,
      contextWindow: 200000
    },
    "claude-opus-4-20250514": {
      inputTokens: 500,
      outputTokens: 200,
      cacheReadInputTokens: 300,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0.0089,
      contextWindow: 200000
    }
  }
}
```

## 참고 자료

- [Agent SDK TypeScript 문서](https://docs.claude.com/en/api/agent-sdk/typescript)
- [Agent SDK Migration Guide](https://docs.claude.com/en/api/agent-sdk/migration-guide)
- [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)