import { NextResponse } from 'next/server';
import { getActiveSession } from '@/lib/services/chat-sessions';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const session = await getActiveSession(project_id);
    if (!session) {
      return NextResponse.json({ success: false, error: 'No active session found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[API] Failed to get active session:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get active session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
