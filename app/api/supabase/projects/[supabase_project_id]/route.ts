import { NextResponse } from 'next/server';
import { getSupabaseProject } from '@/lib/services/supabase';

interface RouteContext {
  params: Promise<{ supabase_project_id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { supabase_project_id } = await params;
    const project = await getSupabaseProject(supabase_project_id);
    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('[API] Failed to fetch Supabase project:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Supabase project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
