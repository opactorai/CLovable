/**
 * StreamManager - Server-Sent Events (SSE) Connection Management
 * Manages SSE connections per project and sends real-time messages.
 */

import type { RealtimeEvent } from '@/types';
import { websocketManager } from '@/lib/server/websocket-manager';

/**
 * SSE Stream Manager
 * Supports multiple client connections per project.
 */
export class StreamManager {
  private streams: Map<string, Set<ReadableStreamDefaultController>>;
  private static instance: StreamManager;

  private constructor() {
    this.streams = new Map();
  }

  /**
   * Return Singleton instance
   */
  public static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  /**
   * Add SSE connection to project
   */
  public addStream(projectId: string, controller: ReadableStreamDefaultController): void {
    if (!this.streams.has(projectId)) {
      this.streams.set(projectId, new Set());
    }
    this.streams.get(projectId)!.add(controller);
    console.log(`[StreamManager] Added stream for project: ${projectId}`);
  }

  /**
   * Remove SSE connection from project
   */
  public removeStream(projectId: string, controller: ReadableStreamDefaultController): void {
    const projectStreams = this.streams.get(projectId);
    if (projectStreams) {
      projectStreams.delete(controller);
      console.log(`[StreamManager] Removed stream for project: ${projectId}`);

      if (projectStreams.size === 0) {
        this.streams.delete(projectId);
        console.log(`[StreamManager] No more streams for project: ${projectId}`);
      }
    }
  }

  /**
   * Send event to all clients of a project
   */
  public publish(projectId: string, event: RealtimeEvent): void {
    websocketManager.broadcast(projectId, event);

    const projectStreams = this.streams.get(projectId);
    if (!projectStreams || projectStreams.size === 0) {
      return;
    }

    const message = `data: ${JSON.stringify(event)}\n\n`;
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    projectStreams.forEach((controller) => {
      try {
        controller.enqueue(encodedMessage);
      } catch (error) {
        console.error(`[StreamManager] Failed to send message:`, error);
        // Remove dead connections
        this.removeStream(projectId, controller);
      }
    });
  }

  /**
   * Return number of connected streams for a project
   */
  public getStreamCount(projectId: string): number {
    const projectStreams = this.streams.get(projectId);
    return projectStreams ? projectStreams.size : 0;
  }

  /**
   * Return total number of streams across all projects
   */
  public getTotalStreamCount(): number {
    let total = 0;
    this.streams.forEach((streams) => {
      total += streams.size;
    });
    return total;
  }

  /**
   * Close all stream connections for a project
   */
  public closeProjectStreams(projectId: string): void {
    const projectStreams = this.streams.get(projectId);
    if (projectStreams) {
      projectStreams.forEach((controller) => {
        try {
          controller.close();
        } catch (error) {
          console.error(`[StreamManager] Failed to close stream:`, error);
        }
      });
      this.streams.delete(projectId);
      console.log(`[StreamManager] Closed all streams for project: ${projectId}`);
    }
  }

  /**
   * Close all stream connections
   */
  public closeAllStreams(): void {
    this.streams.forEach((projectStreams, projectId) => {
      this.closeProjectStreams(projectId);
    });
    console.log(`[StreamManager] Closed all streams`);
  }
}

// Export Singleton instance (stable across HMR and route module reloads)
const g = globalThis as unknown as { __claudable_stream_mgr__?: StreamManager };
export const streamManager: StreamManager =
  g.__claudable_stream_mgr__ ?? (g.__claudable_stream_mgr__ = StreamManager.getInstance());
