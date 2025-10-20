/**
 * GET /api/projects/[id]/files - Get project directory list
 */

import { NextRequest, NextResponse } from 'next/server';
import { listProjectDirectory, FileBrowserError } from '@/lib/services/file-browser';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const url = new URL(request.url);
    const dir = url.searchParams.get('path') ?? '.';

    const entries = await listProjectDirectory(project_id, dir);

    return NextResponse.json({
      success: true,
      data: {
        entries,
      },
    });
  } catch (error) {
    if (error instanceof FileBrowserError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('[API] Failed to list project files:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list project files',
      },
      { status: 500 }
    );
  }
}
