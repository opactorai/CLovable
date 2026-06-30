'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/cloud/RequireAuth';
import { useCloudAuth } from '@/lib/cloud/AuthProvider';
import { cloudApi, type CloudProject } from '@/lib/cloud/api';
import { ApiKeyPanel } from './ApiKeyPanel';

function statusColor(status: string): string {
  switch (status) {
    case 'running':
    case 'executing':
      return 'bg-green-500/20 text-green-400';
    case 'error':
      return 'bg-red-500/20 text-red-400';
    case 'provisioning':
      return 'bg-yellow-500/20 text-yellow-400';
    default:
      return 'bg-bolt-bg-tertiary text-bolt-text-secondary';
  }
}

function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useCloudAuth();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [keyConfigured, setKeyConfigured] = useState(false);

  const load = useCallback(async () => {
    try {
      const { projects } = await cloudApi.listProjects();
      setProjects(projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { project } = await cloudApi.createProject({
        projectName: name.trim(),
        initialPrompt: prompt.trim() || undefined,
      });
      // Kick off the initial generation if a prompt was supplied.
      if (prompt.trim()) {
        await cloudApi.act(project.id, { instruction: prompt.trim(), isInitialPrompt: true });
      }
      router.push(`/cloud/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this project and its workspace?')) return;
    await cloudApi.deleteProject(id).catch(() => {});
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Projects</h1>
          <p className="text-sm text-bolt-text-secondary">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-lg border border-bolt-border-color px-3 py-1.5 text-sm hover:bg-bolt-bg-tertiary"
        >
          Sign out
        </button>
      </header>

      <ApiKeyPanel onChange={setKeyConfigured} />

      <form
        onSubmit={create}
        className="mb-8 rounded-2xl border border-bolt-border-color bg-bolt-bg-secondary p-5"
      >
        <h2 className="mb-3 text-sm font-semibold">New project</h2>
        {!keyConfigured && (
          <p className="mb-3 text-xs text-yellow-400">Add your Anthropic API key above to start generating.</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-56"
          />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='Describe your app — e.g. "Build a Todo app with dark mode"'
            className="w-full flex-1 rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={creating || !keyConfigured}
            title={!keyConfigured ? 'Add your Anthropic API key first' : undefined}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-bolt-text-secondary">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-bolt-text-secondary">No projects yet. Create one above.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group rounded-xl border border-bolt-border-color bg-bolt-bg-secondary p-4 transition hover:border-brand-500"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => router.push(`/cloud/${p.id}`)}
                  className="text-left font-semibold hover:text-brand-400"
                >
                  {p.project_name}
                </button>
                <span className={`rounded px-2 py-0.5 text-xs ${statusColor(p.status)}`}>{p.status}</span>
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-xs text-bolt-text-secondary">{p.description}</p>
              )}
              <div className="mt-3 flex gap-3 text-xs text-bolt-text-tertiary">
                <button onClick={() => router.push(`/cloud/${p.id}`)} className="hover:text-brand-400">
                  Open
                </button>
                <button onClick={() => remove(p.id)} className="hover:text-red-400">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CloudHome() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
