/**
 * Project artifact storage. Archives a workspace directory into a tar.gz and
 * uploads it to the Supabase Storage `project-artifacts` bucket; produces
 * short-lived signed URLs for owner downloads.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-fs';
import { env } from '../config/env';
import { admin } from '../lib/supabase';
import { logger } from '../lib/logger';
import { httpErrors } from '../lib/errors';
import { updateProject } from './projects';

const BUCKET = env.SUPABASE_STORAGE_BUCKET;
const IGNORE = ['node_modules', '.git', '.next', 'dist'];

function artifactObjectPath(projectId: string): string {
  return `${projectId}/workspace-${Date.now()}.tar.gz`;
}

/** Pack a workspace dir to a temp tar.gz and return its path + size. */
async function packWorkspace(workspacePath: string): Promise<{ file: string; size: number }> {
  const tmp = path.join(os.tmpdir(), `claudable-${Date.now()}.tar.gz`);
  const out = fs.createWriteStream(tmp);
  const packStream = tar.pack(workspacePath, {
    ignore: (name) => IGNORE.some((seg) => name.split(path.sep).includes(seg)),
  });
  await pipeline(packStream, createGzip(), out);
  const size = fs.statSync(tmp).size;
  return { file: tmp, size };
}

/**
 * Archive a project's workspace and upload it. Records latest_artifact_path on
 * the project. Best-effort: never leaves a half-written "latest" pointer.
 */
export async function archiveWorkspace(projectId: string, workspacePath: string): Promise<string> {
  const { file, size } = await packWorkspace(workspacePath);
  try {
    const objectPath = artifactObjectPath(projectId);
    const body = fs.readFileSync(file);
    const { error } = await admin.storage.from(BUCKET).upload(objectPath, body, {
      contentType: 'application/gzip',
      upsert: true,
    });
    if (error) {
      throw httpErrors.internal(`Artifact upload failed: ${error.message}`);
    }
    // Only update the pointer after a successful upload.
    await updateProject(projectId, { latest_artifact_path: objectPath });
    logger.info({ projectId, objectPath, size }, 'Workspace archived');
    return objectPath;
  } finally {
    fs.promises.unlink(file).catch(() => {});
  }
}

/** Signed URL for the latest artifact, valid for `expiresInSec`. */
export async function getDownloadUrl(objectPath: string, expiresInSec = 300): Promise<string> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw httpErrors.internal(`Failed to create download URL: ${error?.message}`);
  }
  return data.signedUrl;
}

/** Remove all artifacts for a project (called on delete). */
export async function deleteArtifacts(projectId: string): Promise<void> {
  const { data, error } = await admin.storage.from(BUCKET).list(projectId);
  if (error || !data) return;
  const paths = data.map((o) => `${projectId}/${o.name}`);
  if (paths.length > 0) {
    await admin.storage.from(BUCKET).remove(paths).catch(() => {});
  }
}
