import { prisma } from '@/lib/db/client';

const SUPPORTED_PROVIDERS = ['github', 'supabase', 'vercel'] as const;
export type ServiceProvider = (typeof SUPPORTED_PROVIDERS)[number];

interface ServiceTokenRecord {
  id: string;
  provider: ServiceProvider;
  name: string;
  token: string | null;
  created_at: string;
  last_used: string | null;
}

function assertProvider(provider: string): asserts provider is ServiceProvider {
  if (!SUPPORTED_PROVIDERS.includes(provider as ServiceProvider)) {
    throw new Error('Invalid provider');
  }
}

function toResponse(model: {
  id: string;
  provider: string;
  name: string;
  token: string;
  createdAt: Date;
  lastUsed: Date | null;
}): ServiceTokenRecord {
  return {
    id: model.id,
    provider: model.provider as ServiceProvider,
    name: model.name,
    token: model.token,
    created_at: model.createdAt.toISOString(),
    last_used: model.lastUsed ? model.lastUsed.toISOString() : null,
  };
}

export async function createServiceToken(
  provider: string,
  token: string,
  name: string,
): Promise<ServiceTokenRecord> {
  assertProvider(provider);

  if (!token.trim()) {
    throw new Error('Token cannot be empty');
  }

  await prisma.serviceToken.deleteMany({
    where: { provider },
  });

  const stored = await prisma.serviceToken.create({
    data: {
      provider,
      name: name.trim() || `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Token`,
      token: token.trim(),
    },
  });

  return toResponse(stored);
}

export async function getServiceToken(provider: string): Promise<ServiceTokenRecord | null> {
  assertProvider(provider);

  const record = await prisma.serviceToken.findFirst({
    where: { provider },
    orderBy: { createdAt: 'desc' },
  });

  return record ? toResponse(record) : null;
}

export async function deleteServiceToken(tokenId: string): Promise<boolean> {
  try {
    await prisma.serviceToken.delete({
      where: { id: tokenId },
    });
    return true;
  } catch (error) {
    return false;
  }
}

export async function getPlainServiceToken(provider: string): Promise<string | null> {
  assertProvider(provider);

  const record = await prisma.serviceToken.findFirst({
    where: { provider },
  });

  if (!record) {
    return null;
  }

  return record.token;
}

export async function touchServiceToken(provider: string): Promise<void> {
  assertProvider(provider);

  await prisma.serviceToken.updateMany({
    where: { provider },
    data: { lastUsed: new Date() },
  });
}
