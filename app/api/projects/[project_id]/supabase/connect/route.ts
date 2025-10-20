import { NextRequest, NextResponse } from 'next/server';
import { connectExistingSupabase } from '@/lib/services/supabase';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const body = await request.json();
    const projectUrl = typeof body?.project_url === 'string' ? body.project_url : undefined;
    if (!projectUrl) {
      return NextResponse.json({ success: false, error: 'project_url is required' }, { status: 400 });
    }

    const result = await connectExistingSupabase(project_id, { projectUrl, projectName: body?.project_name });
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
