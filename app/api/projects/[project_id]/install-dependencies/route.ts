/**
 * POST /api/projects/[project_id]/install-dependencies
 * Run npm install (or equivalent) for a project workspace.
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
    const result = await previewManager.installDependencies(project_id);

    return NextResponse.json({
      success: true,
      logs: result.logs,
    });
  } catch (error) {
    console.error('[API] Failed to install dependencies:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to install dependencies',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
