import { Suspense } from 'react';
import GithubInstallErrorClient from './client-content';

interface GithubInstallErrorPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function GithubInstallErrorPage({
  searchParams,
}: GithubInstallErrorPageProps) {
  const rawMessage = searchParams?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage[0]
    : (rawMessage ?? 'GitHub installation failed. Please try again.');

  return (
    <Suspense fallback={null}>
      <GithubInstallErrorClient message={message} />
    </Suspense>
  );
}
