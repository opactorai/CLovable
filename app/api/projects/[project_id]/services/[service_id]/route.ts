import { NextResponse } from 'next/server';
import { deleteProjectService } from '@/lib/services/project-services';

interface RouteContext {
  params: Promise<{ project_id: string; service_id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { service_id } = await params;
    const deleted = await deleteProjectService(service_id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Service disconnected' });
  } catch (error) {
    console.error('[API] Failed to delete project service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project service',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
