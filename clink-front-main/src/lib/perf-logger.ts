const enabledFlag = (() => {
  if (typeof process !== 'undefined') {
    const env = process.env?.NEXT_PUBLIC_PERF_LOG;
    if (env === '1') return true;
    if (env === '0') return false;
    if (process.env?.NODE_ENV === 'production') return false;
  }
  if (typeof window !== 'undefined') {
    const flag = (window as any).__PERF_LOG__;
    if (flag === true) return true;
    if (flag === false) return false;
  }
  return true;
})();

const marks = new Map<string, number>();

function now(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export function perfStart(name: string): void {
  if (!enabledFlag) return;
  marks.set(name, now());
}

export function perfEnd(name: string, metadata?: Record<string, any>): void {
  if (!enabledFlag) return;
  const start = marks.get(name);
  if (start == null) {
    return;
  }
  const duration = now() - start;
  marks.delete(name);
  const payload = metadata ? ` ${JSON.stringify(metadata)}` : '';
  // eslint-disable-next-line no-console
  console.info(`[perf] ${name}: ${duration.toFixed(1)}ms${payload}`);
}

export async function perfMeasure<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> {
  if (!enabledFlag) {
    return fn();
  }
  perfStart(name);
  try {
    const result = await fn();
    perfEnd(name, metadata);
    return result;
  } catch (error) {
    perfEnd(name, { ...(metadata ?? {}), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
