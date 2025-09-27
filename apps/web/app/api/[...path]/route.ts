import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ENV_BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;

async function proxy(request: Request, { params }: { params: { path: string[] } }) {
  const cookieStore = cookies();
  const cookieBackend = cookieStore.get('backend_base_url')?.value;
  const BACKEND_BASE_URL = cookieBackend || ENV_BACKEND_BASE_URL;
  if (!BACKEND_BASE_URL) {
    // Graceful fallbacks for common endpoints to avoid breaking the UI
    const pathOnly = (params.path || []).join('/');
    const method = request.method.toUpperCase();
    if (method === 'GET') {
      if (pathOnly === 'projects') {
        return NextResponse.json([]);
      }
      if (pathOnly === 'settings/cli-status') {
        return NextResponse.json({
          claude: { installed: true, checking: false, version: 'n/a' },
          cursor: { installed: true, checking: false, version: 'n/a' },
          codex: { installed: true, checking: false, version: 'n/a' },
          gemini: { installed: true, checking: false, version: 'n/a' },
          qwen: { installed: true, checking: false, version: 'n/a' }
        });
      }
      if (pathOnly === 'settings/global') {
        return NextResponse.json({ default_cli: 'claude', cli_settings: {} });
      }
      if (pathOnly.startsWith('tokens/')) {
        // Simulate not configured token
        return NextResponse.json({ detail: 'Token not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'BACKEND_BASE_URL is not configured. Set it in Global Settings → General.' }, { status: 500 });
  }

  const url = new URL(request.url);
  const path = params.path?.join('/') || '';
  const targetUrl = `${BACKEND_BASE_URL}/api/${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-proto');

  // Inject Authorization header from cookie if present
  const authBearer = cookieStore.get('backend_auth_bearer')?.value;
  if (authBearer && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${authBearer}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init as any);
    const resHeaders = new Headers(upstream.headers);
    // Remove hop-by-hop headers
    resHeaders.delete('transfer-encoding');
    resHeaders.delete('content-encoding');
    resHeaders.delete('connection');

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: resHeaders
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Proxy request failed', details: String(err) }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };

