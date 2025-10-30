/**
 * GET /api/projects/[id]/files/content - Get file content
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readProjectFileContent,
  writeProjectFileContent,
  FileBrowserError,
} from '@/lib/services/file-browser';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'path query parameter is required' },
        { status: 400 }
      );
    }

    const file = await readProjectFileContent(project_id, filePath);

    return NextResponse.json({
      success: true,
      data: file,
    });
  } catch (error) {
    if (error instanceof FileBrowserError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('[API] Failed to read project file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read project file',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json();
    const filePath = body.path;
    const content = body.content;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'path is required' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'content must be a string' },
        { status: 400 }
      );
    }

    await writeProjectFileContent(project_id, filePath, content);

    return NextResponse.json({
      success: true,
      data: { path: filePath },
    });
  } catch (error) {
    if (error instanceof FileBrowserError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('[API] Failed to write project file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to write project file',
      },
      { status: 500 }
    );
  }
}
