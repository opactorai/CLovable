import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClientPage from '../HomeClientPage';

export const metadata: Metadata = {
  title: 'Dev Mode - Build from Your Repository',
  description: 'Connect your GitHub repository and build with Clink. Bring your own CLI Agents - Claude Code, Codex, and Gemini.',
  alternates: {
    canonical: '/dev',
  },
};

export default function DevPage() {
  return (
    <Suspense fallback={null}>
      <HomeClientPage initialMode="dev" />
    </Suspense>
  );
}
