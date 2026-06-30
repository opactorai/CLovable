'use client';

import { useCallback, useEffect, useState } from 'react';
import { cloudApi } from '@/lib/cloud/api';

/**
 * BYOK panel: lets the user store their own Anthropic API key (write-only).
 * The key is never read back from the server — we only show configured state.
 * onChange notifies the parent so it can gate project creation until a key exists.
 */
export function ApiKeyPanel({ onChange }: { onChange?: (configured: boolean) => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { configured } = await cloudApi.getKeyStatus();
      setConfigured(configured);
      onChange?.(configured);
    } catch {
      setConfigured(false);
    }
  }, [onChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await cloudApi.setKey(value.trim());
      setValue('');
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save key');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await cloudApi.deleteKey();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const unset = configured === false;

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        unset ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-bolt-border-color bg-bolt-bg-secondary'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Anthropic API key</h2>
          <p className="text-xs text-bolt-text-secondary">
            {configured === null
              ? 'Checking…'
              : configured
                ? 'Configured — your key is used to run Claude Code. It is stored encrypted and never shown again.'
                : 'Required to generate apps. Get one at console.anthropic.com → API Keys.'}
          </p>
        </div>
        {configured && !editing && (
          <div className="flex shrink-0 gap-2">
            <span className="rounded bg-green-500/15 px-2 py-1 text-xs text-green-400">✓ Set</span>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-bolt-border-color px-2 py-1 text-xs hover:bg-bolt-bg-tertiary"
            >
              Replace
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-lg border border-bolt-border-color px-2 py-1 text-xs text-red-400 hover:bg-bolt-bg-tertiary"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {(unset || editing) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            className="flex-1 rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={save}
            disabled={busy || !value.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save key'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(false);
                setValue('');
              }}
              className="rounded-lg border border-bolt-border-color px-3 py-2 text-sm hover:bg-bolt-bg-tertiary"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
