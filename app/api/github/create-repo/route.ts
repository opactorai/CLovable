import { NextRequest, NextResponse } from 'next/server';
import { createRepository, getGithubUser } from '@/lib/services/github';

export async function POST(request: NextRequest) {
  try {
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

    const repo = await createRepository({
      repoName,
      description,
      private: isPrivate,
    });

    const user = await getGithubUser();

    return NextResponse.json({
      success: true,
      repo_url: repo.html_url,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
      owner: user.login,
    });
  } catch (error) {
    console.error('[API] Failed to create GitHub repository:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create GitHub repository',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
