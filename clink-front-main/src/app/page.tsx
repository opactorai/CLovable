import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClientPage from './HomeClientPage';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeClientPage />
    </Suspense>
  );
}
