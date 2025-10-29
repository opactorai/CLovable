import { NextRequest, NextResponse } from 'next/server';
import { createServiceToken } from '@/lib/services/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = typeof body?.provider === 'string' ? body.provider : '';
    const token = typeof body?.token === 'string' ? body.token : '';
    const name = typeof body?.name === 'string' ? body.name : '';

    const record = await createServiceToken(provider, token, name);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Invalid provider' || message === 'Token cannot be empty' ? 400 : 500;

    console.error('[Tokens API] Failed to create token:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save token',
        message,
      },
      { status },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
