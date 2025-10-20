/**
 * AI Action API Route
 * POST /api/chat/[project_id]/act - Execute AI command
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  updateProject,
  updateProjectActivity,
} from '@/lib/services/project';
import { createMessage } from '@/lib/services/message';
import { initializeNextJsProject, applyChanges } from '@/lib/services/cli/claude';
import { CLAUDE_DEFAULT_MODEL, normalizeClaudeModelId } from '@/lib/constants/claudeModels';
import { streamManager } from '@/lib/services/stream';
import type { ChatActRequest } from '@/types/backend';
import { generateProjectId } from '@/lib/utils';
import { previewManager } from '@/lib/services/preview';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { serializeMessage } from '@/lib/serializers/chat';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

function coerceString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';

function resolveAssetsPath(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId, 'assets');
}

function ensureAbsoluteAssetPath(projectId: string, inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.join(PROJECTS_DIR, projectId, inputPath);
}

function resolveProjectRoot(projectId: string, repoPath?: string | null): string {
  if (repoPath) {
    return path.isAbsolute(repoPath) ? repoPath : path.resolve(process.cwd(), repoPath);
  }
  return path.resolve(process.cwd(), PROJECTS_DIR, projectId);
}

async function mirrorAssetToPublic(
  projectRoot: string,
  filename: string,
  sourcePath: string,
): Promise<{ publicPath: string | null; publicUrl: string | null }> {
  try {
    const uploadsDir = path.join(projectRoot, 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const destinationPath = path.join(uploadsDir, filename);
    try {
      await fs.access(destinationPath);
    } catch {
      await fs.copyFile(sourcePath, destinationPath);
    }
    return { publicPath: destinationPath, publicUrl: `/uploads/${filename}` };
  } catch (error) {
    console.warn('[API] Failed to mirror asset into public/uploads:', error);
    return { publicPath: null, publicUrl: null };
  }
}

function inferExtensionFromMime(mime?: string): string {
  if (!mime) return '.png';
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('svg')) return '.svg';
  return '.png';
}

async function materializeBase64Image(
  projectId: string,
  projectRoot: string,
  base64: string,
  nameHint?: string,
  mimeType?: string,
): Promise<{ absolutePath: string; filename: string; publicUrl: string | null }> {
  const buffer = Buffer.from(base64, 'base64');
  const extension = inferExtensionFromMime(mimeType);
  const safeName = nameHint && nameHint.trim() ? nameHint.trim() : `image-${randomUUID()}`;
  const filename = `${safeName.replace(/[^a-zA-Z0-9-_]/g, '-') || 'image'}-${randomUUID()}${extension}`;
  const assetsDir = resolveAssetsPath(projectId);
  await fs.mkdir(assetsDir, { recursive: true });
  const absolutePath = path.join(assetsDir, filename);
  await fs.writeFile(absolutePath, buffer);
  const mirror = await mirrorAssetToPublic(projectRoot, filename, absolutePath);
  return {
    absolutePath,
    filename,
    publicUrl: mirror.publicUrl,
  };
}

type RawImageAttachment = Record<string, unknown>;

async function normalizeImageAttachment(
  projectId: string,
  projectRoot: string,
  raw: RawImageAttachment,
  index: number,
): Promise<{ name: string; path: string; url: string; publicUrl?: string } | null> {
  const name = typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : `Image ${index + 1}`;
  const providedUrl = typeof raw.url === 'string' && raw.url.trim().length > 0 ? raw.url.trim() : undefined;
  const providedPublicUrl =
    typeof raw.public_url === 'string' && raw.public_url.trim().length > 0
      ? raw.public_url.trim()
      : typeof raw.publicUrl === 'string' && raw.publicUrl.trim().length > 0
      ? raw.publicUrl.trim()
      : undefined;

  const pathValue =
    typeof raw.path === 'string' && raw.path.trim().length > 0 ? ensureAbsoluteAssetPath(projectId, raw.path.trim()) : null;

  const base64DataCandidate =
    typeof raw.base64_data === 'string'
      ? raw.base64_data
      : typeof raw.base64Data === 'string'
      ? raw.base64Data
      : null;

  const mimeTypeCandidate =
    typeof raw.mime_type === 'string'
      ? raw.mime_type
      : typeof raw.mimeType === 'string'
      ? raw.mimeType
      : undefined;

  if (pathValue) {
    try {
      await fs.stat(pathValue);
      const filename = path.basename(pathValue);
      let effectivePublicUrl = providedPublicUrl;
      if (!effectivePublicUrl) {
        const mirror = await mirrorAssetToPublic(projectRoot, filename, pathValue);
        effectivePublicUrl = mirror.publicUrl ?? undefined;
      }
      return {
        name,
        path: pathValue,
        url: providedUrl ?? `/api/assets/${projectId}/${filename}`,
        publicUrl: effectivePublicUrl,
      };
    } catch {
      // fall through and try to materialize if base64 present
    }
  }

  if (base64DataCandidate) {
    try {
      const materialized = await materializeBase64Image(
        projectId,
        projectRoot,
        base64DataCandidate,
        name,
        mimeTypeCandidate,
      );
      return {
        name,
        path: materialized.absolutePath,
        url: providedUrl ?? `/api/assets/${projectId}/${materialized.filename}`,
        publicUrl: providedPublicUrl ?? materialized.publicUrl ?? undefined,
      };
    } catch (error) {
      console.error('[API] Failed to materialize base64 image:', error);
      return null;
    }
  }

  return null;
}

/**
 * POST /api/chat/[project_id]/act
 * Execute AI command
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const rawBody = await request.json().catch(() => ({}));
    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as ChatActRequest &
      Record<string, unknown>;

    const project = await getProjectById(project_id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    const legacyBody = body as Record<string, unknown>;
    const projectRoot = resolveProjectRoot(project_id, project.repoPath);
    const rawInstruction = typeof body.instruction === 'string' ? body.instruction : '';
    const instructionWithoutLegacyPaths = rawInstruction.replace(/\n*Image #\d+ path: [^\n]+/g, '').trim();

    const rawImages: RawImageAttachment[] = Array.isArray((body as Record<string, unknown>).images)
      ? ((body as Record<string, unknown>).images as RawImageAttachment[])
      : Array.isArray(legacyBody['images'])
      ? (legacyBody['images'] as RawImageAttachment[])
      : [];

    const processedImages: { name: string; path: string; url: string; publicUrl?: string }[] = [];
    for (let index = 0; index < rawImages.length; index += 1) {
      const normalized = await normalizeImageAttachment(project_id, projectRoot, rawImages[index], index);
      if (normalized) {
        processedImages.push(normalized);
      }
    }

    const imageLines = processedImages.map((image, idx) => `Image #${idx + 1} path: ${image.path}`);
    const finalInstruction = [instructionWithoutLegacyPaths, imageLines.join('\n')]
      .filter((segment) => segment && segment.trim().length > 0)
      .join('\n\n')
      .trim();

    if (!finalInstruction) {
      return NextResponse.json(
        { success: false, error: 'instruction or images are required' },
        { status: 400 },
      );
    }

    const cliPreferenceRaw =
      coerceString((body as Record<string, unknown>).cliPreference) ??
      coerceString(legacyBody['cli_preference']) ??
      project.preferredCli ??
      'claude';
    const cliPreference = cliPreferenceRaw.toLowerCase();

    const selectedModelRaw =
      coerceString(body.selectedModel) ??
      coerceString(legacyBody['selected_model']) ??
      project.selectedModel ??
      CLAUDE_DEFAULT_MODEL;
    const selectedModel = normalizeClaudeModelId(selectedModelRaw);

    const conversationId =
      coerceString(body.conversationId) ?? coerceString(legacyBody['conversation_id']);

    const requestId =
      coerceString(body.requestId) ??
      coerceString(legacyBody['request_id']) ??
      generateProjectId();

    const isInitialPrompt =
      body.isInitialPrompt === true ||
      legacyBody['is_initial_prompt'] === true ||
      legacyBody['is_initial_prompt'] === 'true';

    const metadata =
      processedImages.length > 0
        ? {
            attachments: processedImages.map((image) => ({
              name: image.name,
              url: image.url,
              publicUrl: image.publicUrl,
              path: image.path,
            })),
          }
        : undefined;

    const userMessage = await createMessage({
      projectId: project_id,
      role: 'user',
      messageType: 'chat',
      content: finalInstruction,
      conversationId: conversationId ?? undefined,
      cliSource: cliPreference,
      metadata,
    });

    streamManager.publish(project_id, {
      type: 'message',
      data: serializeMessage(userMessage, { requestId }),
    });

    await updateProjectActivity(project_id);

    const projectPath = project.repoPath || path.join(process.cwd(), 'projects', project_id);

    const existingSelected = project.selectedModel
      ? normalizeClaudeModelId(project.selectedModel)
      : null;

    if (
      project.preferredCli !== cliPreference ||
      existingSelected !== selectedModel
    ) {
      try {
        await updateProject(project_id, {
          preferredCli: cliPreference,
          selectedModel,
        });
      } catch (error) {
        console.error('[API] Failed to persist project CLI/model settings:', error);
      }
    }

    try {
      const status = previewManager.getStatus(project_id);
      if (!status.url) {
        previewManager.start(project_id).catch((error) => {
          console.warn('[API] Failed to auto-start preview (will continue):', error);
        });
      }
    } catch (error) {
      console.warn('[API] Preview auto-start check failed (will continue):', error);
    }

    if (isInitialPrompt) {
      initializeNextJsProject(
        project_id,
        projectPath,
        finalInstruction,
        selectedModel,
        requestId,
      ).catch((error) => {
        console.error('[API] Failed to initialize project:', error);
      });
    } else {
      applyChanges(
        project_id,
        projectPath,
        finalInstruction,
        selectedModel,
        project.activeClaudeSessionId || undefined,
        requestId,
      ).catch((error) => {
        console.error('[API] Failed to execute Claude:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'AI execution started',
      requestId,
      userMessageId: userMessage.id,
      conversationId: conversationId ?? null,
    });
  } catch (error) {
    console.error('[API] Failed to execute AI:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute AI',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
