import { NextRequest, NextResponse } from 'next/server';
import {
  loadGlobalSettings,
  updateGlobalSettings,
  normalizeCliSettings,
} from '@/lib/services/settings';

function serialize(settings: Awaited<ReturnType<typeof loadGlobalSettings>>) {
  return {
    ...settings,
    defaultCli: settings.default_cli,
    cliSettings: settings.cli_settings,
  };
}

export async function GET() {
  const settings = await loadGlobalSettings();
  return NextResponse.json(serialize(settings));
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const candidate = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    const update: Record<string, unknown> = {};

    const defaultCli = candidate.default_cli ?? candidate.defaultCli;
    if (typeof defaultCli === 'string') {
      update.default_cli = defaultCli;
    }

    const cliSettingsRaw = candidate.cli_settings ?? candidate.cliSettings;
    const cliSettings = normalizeCliSettings(cliSettingsRaw as Record<string, unknown> | undefined);
    if (cliSettings) {
      update.cli_settings = cliSettings;
    }

    const nextSettings = await updateGlobalSettings(update);
    return NextResponse.json(serialize(nextSettings));
  } catch (error) {
    console.error('[API] Failed to update global settings:', error);
    return NextResponse.json(
      {
        error: 'Failed to update global settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
