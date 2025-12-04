import { prisma } from '@/lib/db/client';
import type { ProjectServiceConnection } from '@prisma/client';

/** Deserialized service connection with parsed serviceData */
export interface DeserializedServiceConnection {
  id: string;
  projectId: string;
  provider: string;
  status: string;
  serviceData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
}

function serializeServiceData(data: Record<string, unknown>): string {
  return JSON.stringify(data ?? {});
}

function deserializeServiceData(connection: ProjectServiceConnection): DeserializedServiceConnection {
  try {
    return {
      ...connection,
      serviceData: connection.serviceData ? JSON.parse(connection.serviceData) : {},
    };
  } catch (error) {
    console.error(
      `[ProjectServices] Failed to deserialize service data for connection ${connection.id}:`,
      error instanceof Error ? error.message : 'Unknown error',
      '\nRaw data:',
      connection.serviceData
    );
    return {
      ...connection,
      serviceData: {},
    };
  }
}

export async function listProjectServices(projectId: string): Promise<DeserializedServiceConnection[]> {
  const connections = await prisma.projectServiceConnection.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return connections.map(deserializeServiceData);
}

export async function getProjectService(projectId: string, provider: string): Promise<DeserializedServiceConnection | null> {
  const connection = await prisma.projectServiceConnection.findFirst({
    where: { projectId, provider },
  });

  return connection ? deserializeServiceData(connection) : null;
}

export async function upsertProjectServiceConnection(
  projectId: string,
  provider: string,
  serviceData: Record<string, unknown>
): Promise<DeserializedServiceConnection> {
  const existing = await prisma.projectServiceConnection.findFirst({
    where: { projectId, provider },
  });

  if (existing) {
    const updated = await prisma.projectServiceConnection.update({
      where: { id: existing.id },
      data: {
        serviceData: serializeServiceData(serviceData),
        status: 'connected',
      },
    });
    return deserializeServiceData(updated);
  }

  const created = await prisma.projectServiceConnection.create({
    data: {
      projectId,
      provider,
      status: 'connected',
      serviceData: serializeServiceData(serviceData),
    },
  });

  return deserializeServiceData(created);
}

export async function deleteProjectService(serviceId: string): Promise<boolean> {
  try {
    await prisma.projectServiceConnection.delete({
      where: { id: serviceId },
    });
    return true;
  } catch (error) {
    return false;
  }
}

export async function updateProjectServiceData(
  projectId: string,
  provider: string,
  patch: Record<string, unknown>
): Promise<DeserializedServiceConnection> {
  const existing = await prisma.projectServiceConnection.findFirst({
    where: { projectId, provider },
  });

  const nextData = {
    ...(existing ? (existing.serviceData ? JSON.parse(existing.serviceData) : {}) : {}),
    ...patch,
  };

  if (existing) {
    const updated = await prisma.projectServiceConnection.update({
      where: { id: existing.id },
      data: { serviceData: serializeServiceData(nextData) },
    });
    return deserializeServiceData(updated);
  }

  const created = await prisma.projectServiceConnection.create({
    data: {
      projectId,
      provider,
      status: 'connected',
      serviceData: serializeServiceData(nextData),
    },
  });

  return deserializeServiceData(created);
}
