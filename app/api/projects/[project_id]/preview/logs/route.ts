/**
 * GET /api/projects/[id]/preview/logs
 * Provides the buffered stdout/stderr logs for the preview process.
 */

import { NextResponse } from 'next/server';
import { previewManager } from '@/lib/services/preview';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { project_id } = await context.params;
    const logs = previewManager.getLogs(project_id);

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('[API] Failed to fetch preview logs:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch preview logs',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
