/**
 * Project management + execution + files + download.
 * Every route is gated by requireAuth and getOwnedProject (ownership check).
 */
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { asyncHandler, httpErrors } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import {
  createProject,
  deleteProject,
  getOwnedProject,
  listProjects,
} from '../services/projects';
import { appendMessage, listMessages } from '../services/chat';
import { listTree, readFile } from '../services/files';
import { archiveWorkspace, deleteArtifacts, getDownloadUrl } from '../services/storage';
import { sessionManager } from '../workspace/session-manager';
import { runClaude } from '../claude/runner';
import { eventBus } from '../realtime/event-bus';
import { makeEvent, type RealtimeEnvelope } from '../realtime/events';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const createSchema = z.object({
  projectName: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  initialPrompt: z.string().max(20000).optional(),
  selectedModel: z.string().optional(),
});

// List the caller's projects.
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await listProjects(req.user!.id);
    res.json({ projects });
  }),
);

// Create a project.
projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const project = await createProject({ userId: req.user!.id, ...body });
    res.status(201).json({ project });
  }),
);

// Get one project.
projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    res.json({ project });
  }),
);

// Delete a project (tears down container + artifacts + rows).
projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    await sessionManager.destroyWorkspace(project.id).catch(() => {});
    await deleteArtifacts(project.id).catch(() => {});
    await deleteProject(project.id);
    res.json({ ok: true });
  }),
);

const actSchema = z.object({
  instruction: z.string().min(1).max(20000),
  isInitialPrompt: z.boolean().optional(),
  selectedModel: z.string().optional(),
  requestId: z.string().optional(),
});

// Execute a Claude Code turn. Returns immediately; output streams over WS/SSE.
projectsRouter.post(
  '/:id/act',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    const body = actSchema.parse(req.body);
    const requestId = body.requestId ?? randomUUID();

    // Persist + broadcast the user message immediately.
    const userMsg = await appendMessage({
      projectId: project.id,
      role: 'user',
      message: body.instruction,
      requestId,
    });
    eventBus.publish(
      makeEvent('message', project.id, { id: userMsg.id, role: 'user', content: body.instruction }, { requestId }),
    );

    const isInitial = body.isInitialPrompt ?? !project.claude_session_id;

    // Fire async — do not await the full run.
    runClaude({
      projectId: project.id,
      prompt: body.instruction,
      model: body.selectedModel ?? project.selected_model ?? undefined,
      isInitial,
      requestId,
    }).catch(() => {
      /* errors are reported via the event bus inside runClaude */
    });

    res.status(202).json({ ok: true, requestId, userMessageId: userMsg.id });
  }),
);

// Conversation history.
projectsRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    const messages = await listMessages(project.id);
    res.json({ messages });
  }),
);

// SSE fallback stream (WebSocket is primary). Token via ?access_token=.
projectsRouter.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify(makeEvent('connected', project.id, { transport: 'sse' }))}\n\n`);

    const send = (event: RealtimeEnvelope) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = eventBus.subscribe(project.id, send);
    const keepalive = setInterval(() => res.write(': ping\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  }),
);

// File tree of the live workspace.
projectsRouter.get(
  '/:id/files',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (!project.workspace_path) {
      return res.json({ files: [] });
    }
    const files = await listTree(project.workspace_path);
    res.json({ files });
  }),
);

// File contents.
projectsRouter.get(
  '/:id/files/content',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    const rel = req.query.path;
    if (typeof rel !== 'string' || !rel) {
      throw httpErrors.badRequest('Missing ?path');
    }
    if (!project.workspace_path) {
      throw httpErrors.notFound('Workspace not provisioned');
    }
    const content = await readFile(project.workspace_path, rel);
    res.json({ path: rel, content });
  }),
);

// Stop the running workspace (archives first).
projectsRouter.post(
  '/:id/stop',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (project.workspace_path) {
      await archiveWorkspace(project.id, project.workspace_path).catch(() => {});
    }
    await sessionManager.stopWorkspace(project.id);
    res.json({ ok: true });
  }),
);

// Download the latest project archive as a signed URL.
projectsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    let objectPath = project.latest_artifact_path;
    // If nothing archived yet but a workspace exists, snapshot on demand.
    if (!objectPath && project.workspace_path) {
      objectPath = await archiveWorkspace(project.id, project.workspace_path);
    }
    if (!objectPath) {
      throw httpErrors.notFound('No artifact available to download');
    }
    const url = await getDownloadUrl(objectPath);
    res.json({ url });
  }),
);
