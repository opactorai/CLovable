import { NextResponse } from 'next/server';
import { getSupabaseApiKeys } from '@/lib/services/supabase';

interface RouteContext {
  params: Promise<{ supabase_project_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase_project_id } = await context.params;
    const keys = await getSupabaseApiKeys(supabase_project_id);
    return NextResponse.json({ success: true, keys });
  } catch (error) {
    console.error('[API] Failed to fetch Supabase API keys:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Supabase API keys',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
