/**
 * POST /api/projects/[id]/preview/start
 * Launches the development server for a project and returns the preview URL.
 */

import { NextResponse } from 'next/server';
import { previewManager } from '@/lib/services/preview';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const { project_id } = await context.params;
    const preview = await previewManager.start(project_id);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error('[API] Failed to start preview:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to start preview',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
