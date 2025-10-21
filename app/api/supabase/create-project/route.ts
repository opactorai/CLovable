import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseProject } from '@/lib/services/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId =
      typeof body?.project_id === 'string'
        ? body.project_id
        : typeof body?.projectId === 'string'
        ? body.projectId
        : undefined;
    const projectName = typeof body?.project_name === 'string' ? body.project_name : undefined;
    const dbPass = typeof body?.db_pass === 'string' ? body.db_pass : undefined;
    const organizationId =
      typeof body?.organization_id === 'string'
        ? body.organization_id
        : typeof body?.organizationId === 'string'
        ? body.organizationId
        : undefined;

    if (!projectId || !projectName || !dbPass || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'project_id, project_name, organization_id, and db_pass are required' },
        { status: 400 },
      );
    }

    const region = typeof body?.region === 'string' ? body.region : 'us-east-1';
    const result = await createSupabaseProject(projectId, projectName, {
      dbPassword: dbPass,
      region,
      organizationId,
    });
    return NextResponse.json({
      success: true,
      project_id: result.id,
      name: result.name,
      organization_id: result.organization_id,
      status: result.status,
      region: result.region,
      created_at: result.inserted_at ?? result.created_at ?? new Date().toISOString(),
    });
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
