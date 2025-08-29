"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type GlobalAISettings = {
  default_cli: string;
  cli_settings: {
    [key: string]: {
      model?: string;
    };
  };
};

type GlobalSettingsCtx = {
  settings: GlobalAISettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalAISettings>>;
  refresh: () => Promise<void>;
};

const defaultSettings: GlobalAISettings = {
  default_cli: 'claude',
  cli_settings: {},
};

const Ctx = createContext<GlobalSettingsCtx | null>(null);

export function useGlobalSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  return ctx;
}

export default function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
  const [settings, setSettings] = useState<GlobalAISettings>(defaultSettings);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/global`);
      if (res.ok) {
        const s = await res.json();
        setSettings(s);
      }
    } catch (e) {
      console.warn('Failed to refresh global settings', e);
    }
  }, [API_BASE]);

  // Load once on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ settings, setSettings, refresh }), [settings, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

