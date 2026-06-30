/**
 * EventBus — per-project publish/subscribe for realtime events.
 *
 * The Claude runner publishes once; every subscribed transport (WebSocket
 * connections AND SSE responses) receives the event. Stored as a globalThis
 * singleton so hot-reload / multiple imports share one instance.
 */
import type { RealtimeEnvelope } from './events';
import { logger } from '../lib/logger';

type Subscriber = (event: RealtimeEnvelope) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(projectId: string, fn: Subscriber): () => void {
    let set = this.subscribers.get(projectId);
    if (!set) {
      set = new Set();
      this.subscribers.set(projectId, set);
    }
    set.add(fn);
    return () => this.unsubscribe(projectId, fn);
  }

  private unsubscribe(projectId: string, fn: Subscriber): void {
    const set = this.subscribers.get(projectId);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      this.subscribers.delete(projectId);
    }
  }

  publish(event: RealtimeEnvelope): void {
    const set = this.subscribers.get(event.projectId);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try {
        fn(event);
      } catch (err) {
        logger.warn({ err, projectId: event.projectId }, 'EventBus subscriber threw');
      }
    }
  }

  subscriberCount(projectId: string): number {
    return this.subscribers.get(projectId)?.size ?? 0;
  }
}

const g = globalThis as unknown as { __claudable_event_bus__?: EventBus };
export const eventBus: EventBus = g.__claudable_event_bus__ ?? (g.__claudable_event_bus__ = new EventBus());
