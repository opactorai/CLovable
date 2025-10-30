import { NextResponse } from 'next/server';
import { detectEnvConflicts } from '@/lib/services/env';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const result = await detectEnvConflicts(project_id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Env API] Failed to check conflicts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check environment conflicts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
