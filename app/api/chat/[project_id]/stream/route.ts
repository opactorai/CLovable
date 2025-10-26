/**
 * Server-Sent Events (SSE) Stream API
 * GET /api/chat/[project_id]/stream - Real-time streaming
 */

import { NextRequest } from 'next/server';
import { streamManager } from '@/lib/services/stream';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/chat/[project_id]/stream
 * SSE streaming connection
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { project_id } = await params;

  // Create ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Client connected to project: ${project_id}`);

      // Add connection to StreamManager
      streamManager.addStream(project_id, controller);

      // Send connection confirmation message
      const welcomeMessage = `data: ${JSON.stringify({
        type: 'connected',
        data: {
          projectId: project_id,
          timestamp: new Date().toISOString(),
          transport: 'sse',
        },
      })}\n\n`;

      try {
        controller.enqueue(new TextEncoder().encode(welcomeMessage));
      } catch (error) {
        console.error('[SSE] Failed to send welcome message:', error);
      }

      // Heartbeat (every 30 seconds)
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            data: {
              timestamp: new Date().toISOString(),
            },
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeat));
        } catch (error) {
          console.error('[SSE] Failed to send heartbeat:', error);
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected from project: ${project_id}`);
        clearInterval(heartbeatInterval);
        streamManager.removeStream(project_id, controller);
      });
    },

    cancel(controller) {
      console.log(`[SSE] Stream cancelled for project: ${project_id}`);
      streamManager.removeStream(project_id, controller);
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

// Ensure Node runtime + dynamic rendering for consistent in-memory streams
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
