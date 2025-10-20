import { NextResponse } from 'next/server';
import { getCurrentDeploymentStatus } from '@/lib/services/vercel';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const status = await getCurrentDeploymentStatus(project_id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Failed to get deployment status:', error);
    const statusCode = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deployment status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: statusCode },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
