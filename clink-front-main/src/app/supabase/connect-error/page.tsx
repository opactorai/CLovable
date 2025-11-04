import { Suspense } from 'react';
import SupabaseConnectErrorClient from './client-content';

interface SupabaseConnectErrorPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function SupabaseConnectErrorPage({
  searchParams,
}: SupabaseConnectErrorPageProps) {
  const rawMessage = searchParams?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage[0]
    : (rawMessage ?? 'Supabase connection failed. Please try again.');

  return (
    <Suspense fallback={null}>
      <SupabaseConnectErrorClient message={message} />
    </Suspense>
  );
}