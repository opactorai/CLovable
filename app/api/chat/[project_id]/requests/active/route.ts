import { NextResponse } from 'next/server';
import { getActiveRequests } from '@/lib/services/user-requests';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const summary = await getActiveRequests(project_id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[API] Failed to get active requests:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get active requests',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
