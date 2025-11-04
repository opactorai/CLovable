'use client';

import { useEffect } from 'react';
import * as amplitude from '@amplitude/analytics-browser';
import { initializeAmplitude } from '@/lib/analytics';

export default function AmplitudeAnalytics() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  useEffect(() => {
    if (!apiKey || typeof window === 'undefined') return;

    // Initialize via NPM SDK (idempotent)
    initializeAmplitude(apiKey);

    // Dynamically import browser-only plugin to avoid SSR issues
    import('@amplitude/plugin-session-replay-browser')
      .then(({ sessionReplayPlugin }) => {
        try {
          // Add Session Replay plugin after initialization
          amplitude.add(sessionReplayPlugin({ sampleRate: 1 }));
        } catch (err) {
          // Fail gracefully if plugin isn't available
          console.warn('[Amplitude] Session Replay plugin not added:', err);
        }
      })
      .catch((err) => {
        console.warn('[Amplitude] Failed to load Session Replay plugin:', err);
      });
  }, [apiKey]);

  return null;
}
