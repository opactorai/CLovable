import { NextResponse } from 'next/server';
import { listProjectServices } from '@/lib/services/project-services';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { project_id } = await context.params;
    const services = await listProjectServices(project_id);
    const payload = services.map((service) => ({
      ...service,
      service_data: service.serviceData,
    }));
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[API] Failed to load project services:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load project services',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
