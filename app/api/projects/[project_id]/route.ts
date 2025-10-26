/**
 * Single Project API Routes
 * GET /api/projects/[project_id] - Retrieve project
 * PUT /api/projects/[project_id] - Update project
 * DELETE /api/projects/[project_id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  updateProject,
  deleteProject,
} from '@/lib/services/project';
import type { UpdateProjectInput } from '@/types/backend';
import { serializeProject } from '@/lib/serializers/project';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]
 * Retrieve specific project
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const project = await getProjectById(project_id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: serializeProject(project) });
  } catch (error) {
    console.error('[API] Failed to get project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[project_id]
 * Update project
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const body = await request.json();

    const input: UpdateProjectInput = {
      name: body.name,
      description: body.description,
      status: body.status,
      previewUrl: body.previewUrl,
      previewPort: body.previewPort,
      preferredCli: body.preferredCli,
      selectedModel: body.selectedModel,
      settings: body.settings,
    };

    const project = await updateProject(project_id, input);
    return NextResponse.json({ success: true, data: serializeProject(project) });
  } catch (error) {
    console.error('[API] Failed to update project:', error);

    // Distinguish between different error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return NextResponse.json(
          { success: false, error: 'Invalid input', message: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[project_id]
 * Delete project
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    await deleteProject(project_id);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('[API] Failed to delete project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
