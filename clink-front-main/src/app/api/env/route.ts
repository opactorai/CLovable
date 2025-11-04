import { NextResponse } from 'next/server';
import { resolveApiBaseUrl, resolveAppBaseUrl } from '@/lib/env';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    apiUrl: resolveApiBaseUrl(),
    appUrl: resolveAppBaseUrl(),
    vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
  });
}
