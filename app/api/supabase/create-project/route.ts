import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseProject } from '@/lib/services/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = typeof body?.project_id === 'string' ? body.project_id : typeof body?.projectId === 'string' ? body.projectId : undefined;
    const projectName = typeof body?.project_name === 'string' ? body.project_name : undefined;
    const dbPass = typeof body?.db_pass === 'string' ? body.db_pass : undefined;

    if (!projectId || !projectName || !dbPass) {
      return NextResponse.json({ success: false, error: 'project_id, project_name, and db_pass are required' }, { status: 400 });
    }

    const region = typeof body?.region === 'string' ? body.region : 'us-east-1';
    const result = await createSupabaseProject(projectId, projectName, { dbPassword: dbPass, region });
    return NextResponse.json({ success: true, name: result.project_name, project_url: result.project_url });
  } catch (error) {
    console.error('[API] Failed to create Supabase project:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create Supabase project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
