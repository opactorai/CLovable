import { NextRequest, NextResponse } from 'next/server';
import { connectProjectToGitHub } from '@/lib/services/github';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const repoName = typeof body.repo_name === 'string' ? body.repo_name : undefined;
    if (!repoName) {
      return NextResponse.json({ success: false, error: 'repo_name is required' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description : '';
    const isPrivate = typeof body.private === 'boolean' ? body.private : false;

    const result = await connectProjectToGitHub(project_id, {
      repoName,
      description,
      private: isPrivate,
    });

    return NextResponse.json({
      success: true,
      repo_url: result.repo_url,
      clone_url: result.clone_url,
      default_branch: result.default_branch,
      owner: result.owner,
      message: 'GitHub repository created and connected',
    });
  } catch (error) {
    console.error('[API] Failed to connect GitHub repository:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect GitHub repository',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
