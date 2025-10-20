/**
 * Projects API Routes
 * GET /api/projects - 모든 프로젝트 조회
 * POST /api/projects - 새 프로젝트 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects, createProject } from '@/lib/services/project';
import { CLAUDE_DEFAULT_MODEL, normalizeClaudeModelId } from '@/lib/constants/claudeModels';
import type { CreateProjectInput } from '@/backend-types';
import { serializeProjects, serializeProject } from '@/lib/serializers/project';

/**
 * GET /api/projects
 * 모든 프로젝트 목록 조회
 */
export async function GET() {
  try {
    const projects = await getAllProjects();
    return NextResponse.json({ success: true, data: serializeProjects(projects) });
  } catch (error) {
    console.error('[API] Failed to get projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch projects',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * 새 프로젝트 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const preferredCli = String(body.preferredCli || body.preferred_cli || 'claude').toLowerCase();

    const input: CreateProjectInput = {
      project_id: body.project_id,
      name: body.name,
      initialPrompt: body.initialPrompt || body.initial_prompt,
      preferredCli,
      selectedModel: normalizeClaudeModelId(body.selectedModel || body.selected_model || CLAUDE_DEFAULT_MODEL),
      description: body.description,
    };

    // 유효성 검사
    if (!input.project_id || !input.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'project_id and name are required',
        },
        { status: 400 }
      );
    }

    const project = await createProject(input);
    return NextResponse.json({ success: true, data: serializeProject(project) }, { status: 201 });
  } catch (error) {
    console.error('[API] Failed to create project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
