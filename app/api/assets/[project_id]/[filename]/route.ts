import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getProjectById } from '@/lib/services/project';

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';
const PROJECTS_DIR_ABSOLUTE = path.isAbsolute(PROJECTS_DIR)
  ? PROJECTS_DIR
  : path.resolve(process.cwd(), PROJECTS_DIR);

function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ project_id: string; filename: string }> }) {
  const { project_id, filename } = await params;

  try {

    console.log('📸 Asset serving request:', {
      project_id,
      filename,
      projectsDir: PROJECTS_DIR,
      userAgent: _request.headers.get('user-agent')
    });

    const project = await getProjectById(project_id);
    if (!project) {
      console.log('📸 Asset serving failed: Project not found:', project_id);
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const filePath = path.join(PROJECTS_DIR_ABSOLUTE, project_id, 'assets', filename);
    console.log('📸 Checking file path:', {
      filePath,
      exists: await fs.access(filePath).then(() => true).catch(() => false)
    });

    const fileStat = await fs.stat(filePath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      console.log('📸 Asset serving failed: File not found:', {
        filePath,
        fileStat,
        projectAssetsDir: path.join(PROJECTS_DIR, project_id, 'assets')
      });

      // Check if assets directory exists
      const assetsDir = path.join(PROJECTS_DIR_ABSOLUTE, project_id, 'assets');
      const assetsDirExists = await fs.access(assetsDir).then(() => true).catch(() => false);
      console.log('📸 Assets directory exists:', assetsDirExists);

      // List files in assets directory if it exists
      if (assetsDirExists) {
        try {
          const files = await fs.readdir(assetsDir);
          console.log('📸 Files in assets directory:', files);
        } catch (error) {
          console.log('📸 Failed to list assets directory files:', error);
        }
      }

      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const response = new NextResponse(fileBuffer as unknown as BodyInit);
    response.headers.set('Content-Type', inferContentType(filename));
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    console.log('📸 Asset serving success:', {
      filename,
      size: fileBuffer.length,
      contentType: inferContentType(filename),
      project_id
    });

    return response;
  } catch (error) {
    console.error('[Assets Get] Failed:', error);
    console.error('[Assets Get] Error details:', {
      project_id,
      filename,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
