import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getProjectById } from '@/lib/services/project';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';

export async function POST(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const project = await getProjectById(project_id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const b64 = typeof body?.b64_png === 'string' ? body.b64_png : null;
    if (!b64) {
      return NextResponse.json({ success: false, error: 'b64_png is required' }, { status: 400 });
    }

    const buffer = Buffer.from(b64, 'base64');
    const assetsPath = path.join(PROJECTS_DIR, project_id, 'assets');
    await fs.mkdir(assetsPath, { recursive: true });
    const logoPath = path.join(assetsPath, 'logo.png');
    await fs.writeFile(logoPath, buffer);

    return NextResponse.json({ success: true, path: 'assets/logo.png' });
  } catch (error) {
    console.error('[Assets Logo] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
