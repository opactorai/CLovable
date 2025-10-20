import { NextResponse } from 'next/server';
import { checkVercelProjectAvailability } from '@/lib/services/vercel';

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params;
    const result = await checkVercelProjectAvailability(name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to check Vercel project availability:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check Vercel project availability',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
