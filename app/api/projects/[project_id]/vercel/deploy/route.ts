import { NextResponse } from 'next/server';
import { triggerVercelDeployment } from '@/lib/services/vercel';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const result = await triggerVercelDeployment(project_id);
    return NextResponse.json({ success: true, url: result.url, status: result.status });
  } catch (error) {
    console.error('[API] Failed to trigger Vercel deployment:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger Vercel deployment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
