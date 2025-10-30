import net from 'net';

const MAX_PORT = 65_535;
const FALLBACK_PORT_START = 3_100;
const FALLBACK_PORT_END = 3_999;
const DEFAULT_RANGE_SPAN = FALLBACK_PORT_END - FALLBACK_PORT_START;

function normalizePortInput(value?: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_PORT) {
    return null;
  }

  return numeric;
}

function resolveDefaultBounds(): { start: number; end: number } {
  const envStart =
    normalizePortInput(process.env.PREVIEW_PORT_START) ?? FALLBACK_PORT_START;

  const envEndCandidate = normalizePortInput(process.env.PREVIEW_PORT_END);

  const fallbackEnd = Math.min(envStart + DEFAULT_RANGE_SPAN, MAX_PORT);
  const envEnd =
    envEndCandidate && envEndCandidate >= envStart
      ? envEndCandidate
      : fallbackEnd;

  return { start: envStart, end: envEnd };
}

async function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });

    const cleanup = (available: boolean) => {
      socket.removeAllListeners();
      try {
        socket.end();
        socket.destroy();
      } catch {
        // Ignore errors while cleaning up the socket
      }
      resolve(available);
    };

    socket.once('connect', () => cleanup(false));
    socket.once('error', () => cleanup(true));
    socket.setTimeout(500, () => cleanup(true));
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  const results = await Promise.allSettled([
    checkPort('127.0.0.1', port),
    checkPort('::1', port),
  ]);

  return results.every((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Treat failures (e.g., IPv6 unsupported) as available
    return true;
  });
}

export async function findAvailablePort(
  startPort?: number,
  endPort?: number
): Promise<number> {
  const { start: defaultStart, end: defaultEnd } = resolveDefaultBounds();

  const explicitStart = normalizePortInput(startPort);
  const explicitEnd = normalizePortInput(endPort);

  let rangeStart =
    explicitStart ?? normalizePortInput(process.env.PORT) ?? defaultStart;
  rangeStart = Math.max(1, rangeStart);

  if (rangeStart > MAX_PORT) {
    throw new Error(
      `Unable to determine a valid starting port (computed ${rangeStart}).`
    );
  }

  let rangeEnd = explicitEnd ?? defaultEnd;
  if (explicitStart && !explicitEnd) {
    rangeEnd = Math.min(explicitStart + DEFAULT_RANGE_SPAN, MAX_PORT);
  }
  rangeEnd = Math.max(rangeStart, Math.min(rangeEnd, MAX_PORT));

  if (rangeEnd < rangeStart) {
    throw new Error(
      `Unable to determine a valid port range (start ${rangeStart}, end ${rangeEnd}).`
    );
  }

  for (let port = rangeStart; port <= rangeEnd; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new Error(
    `Unable to find an available port between ${rangeStart} and ${rangeEnd}.`
  );
}
