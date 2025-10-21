import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getProjectById } from '@/lib/services/project';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';

function resolveAssetsPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, 'assets');
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const project = await getProjectById(project_id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File field is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'File must be an image' }, { status: 400 });
    }

    const projectAssetsPath = resolveAssetsPath(project_id);
    await fs.mkdir(projectAssetsPath, { recursive: true });

    const originalName = file.name || 'image.png';
    const extension = path.extname(originalName) || '.png';
    const uniqueName = `${randomUUID()}${extension}`;
    const absolutePath = path.join(projectAssetsPath, uniqueName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(arrayBuffer));

    let publicPath: string | null = null;
    let publicUrl: string | null = null;
    try {
      const projectRoot = project.repoPath
        ? (path.isAbsolute(project.repoPath) ? project.repoPath : path.resolve(process.cwd(), project.repoPath))
        : path.resolve(process.cwd(), PROJECTS_DIR, project_id);
      const uploadsDir = path.join(projectRoot, 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      publicPath = path.join(uploadsDir, uniqueName);
      await fs.copyFile(absolutePath, publicPath);
      publicUrl = `/uploads/${uniqueName}`;
    } catch (copyError) {
      console.warn('[Assets Upload] Failed to mirror asset into public/uploads:', copyError);
      publicPath = null;
      publicUrl = null;
    }

    return NextResponse.json({
      success: true,
      path: `assets/${uniqueName}`,
      absolute_path: absolutePath,
      filename: uniqueName,
      original_filename: originalName,
      public_path: publicPath,
      public_url: publicUrl,
    });
  } catch (error) {
    console.error('[Assets Upload] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
