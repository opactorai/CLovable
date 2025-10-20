import { NextResponse } from 'next/server';
import { syncDbToEnvFile } from '@/lib/services/env';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const synced = await syncDbToEnvFile(project_id);
    return NextResponse.json({
      success: true,
      synced_count: synced,
      message: `Synced ${synced} env vars from database to file`,
    });
  } catch (error) {
    console.error('[Env API] Failed to sync DB to file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync database to env file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
