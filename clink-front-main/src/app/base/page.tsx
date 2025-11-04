import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClientPage from '../HomeClientPage';

export const metadata: Metadata = {
  title: 'Base Mode - Build Apps from Scratch',
  description: 'Start building your app from scratch with Clink. Bring your own CLI Agents - Claude Code, Codex, and Gemini.',
  alternates: {
    canonical: '/base',
  },
};

export default function BasePage() {
  return (
    <Suspense fallback={null}>
      <HomeClientPage initialMode="base" />
    </Suspense>
  );
}
