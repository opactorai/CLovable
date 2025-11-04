import { NextRequest, NextResponse } from 'next/server';
import { upsertEnvVar } from '@/lib/services/env';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json();
    if (!body?.key || typeof body.key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'key is required' },
        { status: 400 },
      );
    }
    if (typeof body.value !== 'string') {
      return NextResponse.json(
        { success: false, error: 'value must be a string' },
        { status: 400 },
      );
    }

    const record = await upsertEnvVar(project_id, {
      key: body.key,
      value: body.value,
      scope: body.scope,
      varType: body.var_type ?? body.varType,
      isSecret: body.is_secret ?? body.isSecret,
      description: body.description,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[Env API] Failed to upsert env var:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upsert environment variable',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
