import { NextResponse } from 'next/server';
import { listSupabaseOrganizations } from '@/lib/services/supabase';

export async function GET() {
  try {
    const organizations = await listSupabaseOrganizations();
    return NextResponse.json({ success: true, organizations });
  } catch (error) {
    console.error('[API] Failed to list Supabase organizations:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Supabase organizations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
