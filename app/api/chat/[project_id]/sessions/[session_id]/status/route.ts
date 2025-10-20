import { NextResponse } from 'next/server';
import { getSessionById } from '@/lib/services/chat-sessions';

interface RouteContext {
  params: Promise<{ project_id: string; session_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { project_id, session_id } = await context.params;
    const session = await getSessionById(project_id, session_id);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[API] Failed to get session status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get session status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
