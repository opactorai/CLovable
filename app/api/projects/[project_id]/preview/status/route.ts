/**
 * GET /api/projects/[id]/preview/status
 * Returns the current preview status for the project.
 */

import { NextResponse } from 'next/server';
import { previewManager } from '@/lib/services/preview';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const preview = previewManager.getStatus(project_id);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error('[API] Failed to fetch preview status:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch preview status',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
