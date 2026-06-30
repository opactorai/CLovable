'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCloudAuth } from '@/lib/cloud/AuthProvider';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH === '1';

export default function CloudLoginPage() {
  const router = useRouter();
  const { user, loading, signInWithPassword, signUpWithPassword, signInWithGoogle } = useCloudAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/cloud');
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
        router.replace('/cloud');
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password);
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          setMode('signin');
        } else {
          router.replace('/cloud');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-bolt-border-color bg-bolt-bg-secondary p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold">Claudable Cloud</h1>
        <p className="mb-6 text-sm text-bolt-text-secondary">
          {mode === 'signin' ? 'Sign in to build apps in the browser.' : 'Create your account.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-bolt-border-color bg-bolt-bg-tertiary px-3 py-2 text-sm outline-none focus:border-brand-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-green-400">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {GOOGLE_ENABLED && (
          <button
            onClick={() => signInWithGoogle().catch((e) => setError(e.message))}
            className="mt-3 w-full rounded-lg border border-bolt-border-color py-2 text-sm font-medium hover:bg-bolt-bg-tertiary"
          >
            Continue with Google
          </button>
        )}

        <button
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-center text-xs text-bolt-text-secondary hover:text-bolt-text-primary"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
