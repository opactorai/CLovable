import { NextRequest, NextResponse } from 'next/server';
import { connectVercelProject } from '@/lib/services/vercel';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json();
    const projectName = typeof body?.project_name === 'string' ? body.project_name : undefined;
    if (!projectName) {
      return NextResponse.json({ success: false, error: 'project_name is required' }, { status: 400 });
    }

    const teamId =
      typeof body?.team_id === 'string'
        ? body.team_id
        : typeof body?.teamId === 'string'
        ? body.teamId
        : undefined;

    const result = await connectVercelProject(project_id, projectName, {
      githubRepo: typeof body?.github_repo === 'string' ? body.github_repo : undefined,
      teamId,
    });
    return NextResponse.json({
      success: true,
      data: result,
      message: `Connected Vercel project ${projectName}`,
    });
  } catch (error) {
    console.error('[API] Failed to connect Vercel project:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect Vercel project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
