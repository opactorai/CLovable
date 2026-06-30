'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/cloud/RequireAuth';
import { cloudApi, type CloudMessage, type CloudProject, type FileNode } from '@/lib/cloud/api';
import { useProjectStream, type StreamEvent } from '@/lib/cloud/useProjectStream';

/** A unified transcript row from either loaded history or a live stream event. */
interface Row {
  kind: 'user' | 'assistant' | 'tool' | 'terminal' | 'status' | 'completion';
  text: string;
  meta?: { action?: string; filePath?: string; command?: string; ok?: boolean };
}

function eventToRow(evt: StreamEvent): Row | null {
  const d = evt.data as Record<string, unknown>;
  switch (evt.type) {
    case 'message':
      return { kind: (d.role as Row['kind']) ?? 'assistant', text: String(d.content ?? '') };
    case 'tool':
      if (d.phase === 'result') {
        return { kind: 'terminal', text: String(d.output ?? '') };
      }
      return {
        kind: 'tool',
        text: String(d.filePath ?? d.command ?? d.toolName ?? 'tool'),
        meta: {
          action: d.action as string | undefined,
          filePath: d.filePath as string | undefined,
          command: d.command as string | undefined,
        },
      };
    case 'terminal':
      return { kind: 'terminal', text: String(d.line ?? '') };
    case 'status':
      return { kind: 'status', text: String(d.detail ?? d.status ?? '') };
    case 'completion':
      return {
        kind: 'completion',
        text: d.ok ? 'Run completed' : `Run failed: ${String(d.error ?? 'unknown')}`,
        meta: { ok: Boolean(d.ok) },
      };
    default:
      return null;
  }
}

function Workspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<CloudProject | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [instruction, setInstruction] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { events, state } = useProjectStream(projectId);

  const liveRows = useMemo(
    () => events.map(eventToRow).filter((r): r is Row => r !== null),
    [events],
  );
  const rows = useMemo(() => [...history, ...liveRows], [history, liveRows]);

  const loadProject = useCallback(async () => {
    try {
      const [{ project }, { messages }] = await Promise.all([
        cloudApi.getProject(projectId),
        cloudApi.listMessages(projectId),
      ]);
      setProject(project);
      setHistory(
        messages.map((m: CloudMessage): Row => {
          const meta = (m.metadata ?? {}) as Record<string, unknown>;
          if (m.role === 'tool') {
            return {
              kind: 'tool',
              text: m.message,
              meta: { action: meta.action as string, filePath: meta.filePath as string },
            };
          }
          return { kind: m.role === 'user' ? 'user' : 'assistant', text: m.message };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    }
  }, [projectId]);

  const loadFiles = useCallback(async () => {
    try {
      const { files } = await cloudApi.listFiles(projectId);
      setFiles(files);
    } catch {
      /* workspace may not be provisioned yet */
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
    void loadFiles();
  }, [loadProject, loadFiles]);

  // Auto-scroll + refresh files when a run completes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    const last = events[events.length - 1];
    if (last?.type === 'completion') {
      void loadFiles();
      setSending(false);
    }
  }, [events, loadFiles]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = instruction.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setInstruction('');
    try {
      await cloudApi.act(projectId, { instruction: text });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
      setSending(false);
    }
  };

  const download = async () => {
    try {
      const { url } = await cloudApi.getDownloadUrl(projectId);
      window.open(url, '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download not available yet');
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-bolt-border-color px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/cloud')} className="text-sm text-bolt-text-secondary hover:text-bolt-text-primary">
            ← Projects
          </button>
          <h1 className="font-semibold">{project?.project_name ?? 'Workspace'}</h1>
          <span
            className={`h-2 w-2 rounded-full ${state === 'open' ? 'bg-green-400' : state === 'connecting' ? 'bg-yellow-400' : 'bg-bolt-text-tertiary'}`}
            title={`stream: ${state}`}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={download} className="rounded-lg border border-bolt-border-color px-3 py-1.5 text-sm hover:bg-bolt-bg-tertiary">
            Download
          </button>
          <button
            onClick={() => cloudApi.stop(projectId).then(loadProject)}
            className="rounded-lg border border-bolt-border-color px-3 py-1.5 text-sm hover:bg-bolt-bg-tertiary"
          >
            Stop
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Transcript */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {rows.length === 0 && (
              <p className="text-sm text-bolt-text-secondary">
                Send an instruction below to start Claude Code in your cloud workspace.
              </p>
            )}
            {rows.map((row, i) => (
              <TranscriptRow key={i} row={row} />
            ))}
          </div>

          {error && <p className="px-5 pb-2 text-sm text-red-400">{error}</p>}

          <form onSubmit={send} className="border-t border-bolt-border-color p-3">
            <div className="flex gap-2">
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ask Claude Code to build or change something…"
                className="flex-1 rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {sending ? 'Running…' : 'Send'}
              </button>
            </div>
          </form>
        </section>

        {/* File tree */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-bolt-border-color p-3 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-bolt-text-tertiary">Files</h2>
            <button onClick={loadFiles} className="text-xs text-bolt-text-secondary hover:text-bolt-text-primary">
              Refresh
            </button>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-bolt-text-tertiary">No files yet.</p>
          ) : (
            <FileTree nodes={files} />
          )}
        </aside>
      </div>
    </div>
  );
}

function TranscriptRow({ row }: { row: Row }) {
  if (row.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-brand-600 px-3 py-2 text-sm text-white">{row.text}</div>
      </div>
    );
  }
  if (row.kind === 'assistant') {
    return (
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bolt-bg-secondary px-3 py-2 text-sm">
        {row.text}
      </div>
    );
  }
  if (row.kind === 'tool') {
    return (
      <div className="flex items-center gap-2 text-xs text-bolt-text-secondary">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-brand-400">{row.meta?.action ?? 'Tool'}</span>
        <span className="font-mono">{row.meta?.command ?? row.meta?.filePath ?? row.text}</span>
      </div>
    );
  }
  if (row.kind === 'terminal') {
    return (
      <pre className="overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-xs text-bolt-text-secondary">{row.text}</pre>
    );
  }
  if (row.kind === 'completion') {
    return (
      <div className={`py-1 text-center text-xs ${row.meta?.ok ? 'text-green-400' : 'text-red-400'}`}>— {row.text} —</div>
    );
  }
  return <div className="text-xs italic text-bolt-text-tertiary">{row.text}</div>;
}

function FileTree({ nodes, depth = 0 }: { nodes: FileNode[]; depth?: number }) {
  return (
    <ul className="space-y-0.5 text-xs">
      {nodes.map((node) => (
        <li key={node.path}>
          <div style={{ paddingLeft: depth * 12 }} className="truncate py-0.5 text-bolt-text-secondary">
            {node.type === 'dir' ? '📁' : '📄'} {node.name}
          </div>
          {node.children && node.children.length > 0 && <FileTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <RequireAuth>
      <Workspace projectId={projectId} />
    </RequireAuth>
  );
}
