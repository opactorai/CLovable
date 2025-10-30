import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProjectById } from '@/lib/services/project';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';
const PROJECTS_DIR_ABSOLUTE = path.isAbsolute(PROJECTS_DIR)
  ? PROJECTS_DIR
  : path.resolve(process.cwd(), PROJECTS_DIR);

function resolveProjectRoot(projectId: string, repoPath?: string | null): string {
  if (repoPath) {
    return path.isAbsolute(repoPath) ? repoPath : path.resolve(process.cwd(), repoPath);
  }
  return path.join(PROJECTS_DIR_ABSOLUTE, projectId);
}

async function ensureProject(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const projectRoot = resolveProjectRoot(projectId, project.repoPath);
  return { project, projectRoot };
}

function configPaths(projectRoot: string) {
  const configDir = path.join(projectRoot, '.opencode');
  const configPath = path.join(configDir, 'opencode.jsonc');
  return { configDir, configPath };
}

const EMPTY_TEMPLATE = `// Configure OpenCode here (JSONC).
// Example:
// {
//   "$schema": "https://opencode.ai/config.json"
// }
`;

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const { projectRoot } = await ensureProject(project_id);
    const { configPath } = configPaths(projectRoot);

    let content = EMPTY_TEMPLATE;
    let exists = false;
    try {
      content = await fs.readFile(configPath, 'utf8');
      exists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw error;
      }
    }

    return NextResponse.json({ success: true, content, exists });
  } catch (error) {
    console.error('[API] Failed to load OpenCode config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load OpenCode configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const body = await request.json().catch(() => ({}));
    const candidate = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    const contentRaw = candidate.content;
    if (typeof contentRaw !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid content payload',
        },
        { status: 400 }
      );
    }

    const { projectRoot } = await ensureProject(project_id);
    const { configDir, configPath } = configPaths(projectRoot);

    await fs.mkdir(configDir, { recursive: true });

    const trimmed = contentRaw.trim();
    if (trimmed.length === 0) {
      try {
        await fs.unlink(configPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
      }
      return NextResponse.json({ success: true, content: '', exists: false });
    }

    await fs.writeFile(configPath, contentRaw, 'utf8');
    return NextResponse.json({ success: true, content: contentRaw, exists: true });
  } catch (error) {
    console.error('[API] Failed to save OpenCode config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save OpenCode configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
