import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { encrypt, decrypt } from '@/lib/crypto';
import type { EnvVar } from '@prisma/client';
import type { Project } from '@/types/backend';
import { getProjectById } from '@/lib/services/project';

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';
const PROJECTS_DIR_ABSOLUTE = path.isAbsolute(PROJECTS_DIR)
  ? PROJECTS_DIR
  : path.resolve(process.cwd(), PROJECTS_DIR);

export interface EnvVarRecord {
  id: string;
  key: string;
  value: string;
  scope: string;
  var_type: string;
  is_secret: boolean;
  description?: string | null;
}

interface CreateEnvVarInput {
  key: string;
  value: string;
  scope?: string;
  varType?: string;
  isSecret?: boolean;
  description?: string | null;
}

function resolveRepoRoot(project: Project): string {
  const repoPath = project.repoPath || path.join(PROJECTS_DIR_ABSOLUTE, project.id);
  return path.isAbsolute(repoPath) ? repoPath : path.resolve(process.cwd(), repoPath);
}

function envFilePath(project: Project): string {
  const repoRoot = resolveRepoRoot(project);
  return path.join(repoRoot, '.env');
}

async function ensureProject(projectId: string): Promise<Project> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}

function mapEnvVar(model: EnvVar): EnvVarRecord {
  return {
    id: model.id,
    key: model.key,
    value: decrypt(model.valueEncrypted),
    scope: model.scope,
    var_type: model.varType,
    is_secret: model.isSecret,
    description: model.description,
  };
}

export async function listEnvVars(projectId: string): Promise<EnvVarRecord[]> {
  const records = await prisma.envVar.findMany({
    where: { projectId },
    orderBy: { key: 'asc' },
  });
  const result: EnvVarRecord[] = [];
  for (const record of records) {
    try {
      result.push(mapEnvVar(record));
    } catch (error) {
      console.warn(`[EnvService] Failed to decrypt env var ${record.key}:`, error);
    }
  }
  return result;
}

export async function createEnvVar(
  projectId: string,
  input: CreateEnvVarInput,
): Promise<EnvVarRecord> {
  await ensureProject(projectId);
  try {
    const created = await prisma.envVar.create({
      data: {
        projectId,
        key: input.key,
        valueEncrypted: encrypt(input.value),
        scope: input.scope ?? 'runtime',
        varType: input.varType ?? 'string',
        isSecret: input.isSecret ?? true,
        description: input.description,
      },
    });

    await syncDbToEnvFile(projectId);
    return mapEnvVar(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`Environment variable "${input.key}" already exists`);
    }
    throw error;
  }
}

export async function updateEnvVar(
  projectId: string,
  key: string,
  value: string,
): Promise<boolean> {
  await ensureProject(projectId);
  try {
    await prisma.envVar.update({
      where: {
        projectId_key: {
          projectId,
          key,
        },
      },
      data: {
        valueEncrypted: encrypt(value),
      },
    });

    await syncDbToEnvFile(projectId);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export async function deleteEnvVar(projectId: string, key: string): Promise<boolean> {
  await ensureProject(projectId);
  try {
    await prisma.envVar.delete({
      where: {
        projectId_key: {
          projectId,
          key,
        },
      },
    });

    await syncDbToEnvFile(projectId);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export async function syncDbToEnvFile(projectId: string): Promise<number> {
  const project = await ensureProject(projectId);
  const repoEnvPath = envFilePath(project);

  const envVars = await prisma.envVar.findMany({
    where: { projectId },
    orderBy: { key: 'asc' },
  });

  const entries = envVars.reduce<{ key: string; value: string }[]>((acc, envVar) => {
    try {
      acc.push({ key: envVar.key, value: decrypt(envVar.valueEncrypted) });
    } catch (error) {
      console.warn(`[EnvService] Failed to decrypt env var ${envVar.key}:`, error);
    }
    return acc;
  }, []);

  const header =
    '# Environment Variables\n# This file is automatically synchronized with Project Settings\n\n';

  const contents =
    header +
    entries
      .map(({ key, value }) => {
        if (value === undefined || value === null) {
          return `${key}=`;
        }
        if (/[ \t#"$']/u.test(value)) {
          return `${key}="${value.replace(/"/g, '\\"')}"`;
        }
        return `${key}=${value}`;
      })
      .join('\n') +
    (entries.length > 0 ? '\n' : '');

  await fs.mkdir(path.dirname(repoEnvPath), { recursive: true });
  await fs.writeFile(repoEnvPath, contents, 'utf8');

  return entries.length;
}

function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = contents.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export async function syncEnvFileToDb(projectId: string): Promise<number> {
  const project = await ensureProject(projectId);
  const repoEnvPath = envFilePath(project);

  let fileContents = '';
  try {
    fileContents = await fs.readFile(repoEnvPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  const fileVars = parseEnvFile(fileContents);
  const existingVars = await prisma.envVar.findMany({
    where: { projectId },
  });

  const existingMap = new Map(existingVars.map((envVar) => [envVar.key, envVar]));
  const fileKeys = new Set(Object.keys(fileVars));
  let changes = 0;

  for (const [key, value] of Object.entries(fileVars)) {
    const current = existingMap.get(key);
    if (current) {
      let currentValue: string | null = null;
      try {
        currentValue = decrypt(current.valueEncrypted);
      } catch (error) {
        console.warn(`[EnvService] Failed to decrypt env var ${current.key}:`, error);
      }
      if (currentValue !== value) {
        await prisma.envVar.update({
          where: {
            projectId_key: { projectId, key },
          },
          data: { valueEncrypted: encrypt(value) },
        });
        changes += 1;
      }
    } else {
      await prisma.envVar.create({
        data: {
          projectId,
          key,
          valueEncrypted: encrypt(value),
          scope: 'runtime',
          varType: 'string',
          isSecret: true,
        },
      });
      changes += 1;
    }
  }

  for (const envVar of existingVars) {
    if (!fileKeys.has(envVar.key)) {
      await prisma.envVar.delete({
        where: {
          projectId_key: { projectId, key: envVar.key },
        },
      });
      changes += 1;
    }
  }

  return changes;
}

export async function detectEnvConflicts(projectId: string) {
  const project = await ensureProject(projectId);
  const repoEnvPath = envFilePath(project);

  let fileContents = '';
  try {
    fileContents = await fs.readFile(repoEnvPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fileContents = '';
    } else {
      throw error;
    }
  }

  const fileVars = parseEnvFile(fileContents);
  const dbVars = await listEnvVars(projectId);

  const conflicts: Array<{
    key: string;
    file_value?: string;
    db_value?: string;
    conflict_type: 'file_only' | 'db_only' | 'value_mismatch';
  }> = [];

  const keys = new Set([...Object.keys(fileVars), ...dbVars.map((envVar) => envVar.key)]);

  for (const key of keys) {
    const fileValue = fileVars[key];
    const dbValue = dbVars.find((envVar) => envVar.key === key)?.value;

    if (fileValue === dbValue) {
      continue;
    }

    let conflictType: 'file_only' | 'db_only' | 'value_mismatch';
    if (fileValue !== undefined && dbValue === undefined) {
      conflictType = 'file_only';
    } else if (fileValue === undefined && dbValue !== undefined) {
      conflictType = 'db_only';
    } else {
      conflictType = 'value_mismatch';
    }

    conflicts.push({
      key,
      file_value: fileValue,
      db_value: dbValue,
      conflict_type: conflictType,
    });
  }

  return {
    conflicts,
    has_conflicts: conflicts.length > 0,
  };
}

export async function upsertEnvVar(
  projectId: string,
  input: CreateEnvVarInput,
): Promise<EnvVarRecord> {
  const updated = await prisma.envVar.upsert({
    where: {
      projectId_key: {
        projectId,
        key: input.key,
      },
    },
    update: {
      valueEncrypted: encrypt(input.value),
      description: input.description,
      scope: input.scope ?? 'runtime',
      varType: input.varType ?? 'string',
      isSecret: input.isSecret ?? true,
    },
    create: {
      projectId,
      key: input.key,
      valueEncrypted: encrypt(input.value),
      description: input.description,
      scope: input.scope ?? 'runtime',
      varType: input.varType ?? 'string',
      isSecret: input.isSecret ?? true,
    },
  });

  await syncDbToEnvFile(projectId);
  return mapEnvVar(updated);
}
