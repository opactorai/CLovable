import { NextRequest, NextResponse } from 'next/server';
import { connectExistingSupabase } from '@/lib/services/supabase';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json();
    const supabaseProjectId =
      typeof body?.project_id === 'string'
        ? body.project_id
        : typeof body?.supabase_project_id === 'string'
        ? body.supabase_project_id
        : undefined;
    const projectUrl = typeof body?.project_url === 'string' ? body.project_url : undefined;
    if (!supabaseProjectId || !projectUrl) {
      return NextResponse.json(
        { success: false, error: 'project_id and project_url are required' },
        { status: 400 },
      );
    }

    const result = await connectExistingSupabase(project_id, {
      projectId: supabaseProjectId,
      projectUrl,
      projectName: typeof body?.project_name === 'string' ? body.project_name : undefined,
      region: typeof body?.region === 'string' ? body.region : undefined,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[API] Failed to connect Supabase project:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect Supabase project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
