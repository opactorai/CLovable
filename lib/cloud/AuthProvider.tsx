'use client';

/**
 * Cloud auth context — wraps Supabase Auth for the cloud UI under /cloud.
 * Independent of the desktop AuthContext.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase-client';

interface CloudAuthvalue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<CloudAuthvalue | null>(null);

export function useCloudAuth(): CloudAuthvalue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCloudAuth must be used within CloudAuthProvider');
  return ctx;
}

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  // Client is created in the browser only (never during SSR/prerender, where
  // NEXT_PUBLIC env vars may be absent and the constructor would throw).
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const value = useMemo<CloudAuthvalue>(() => {
    const requireClient = () => {
      if (!supabase) throw new Error('Auth client not ready');
      return supabase;
    };
    return {
      user: session?.user ?? null,
      session,
      loading,
      signInWithPassword: async (email, password) => {
        const { error } = await requireClient().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUpWithPassword: async (email, password) => {
        const { data, error } = await requireClient().auth.signUp({ email, password });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      signInWithGoogle: async () => {
        const { error } = await requireClient().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/cloud` },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await requireClient().auth.signOut();
      },
    };
  }, [supabase, session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
