import { NextResponse } from 'next/server';
import { getActiveSession } from '@/lib/services/chat-sessions';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const session = await getActiveSession(project_id);

    // Return 200 with null data when no session exists (successful query, no results)
    // This prevents console 404 errors while still indicating no active session
    if (!session) {
      return NextResponse.json({ success: true, data: null });
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
