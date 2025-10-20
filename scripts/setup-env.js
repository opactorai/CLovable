#!/usr/bin/env node

/**
 * Development environment bootstrapper.
 * - Ensures .env and .env.local exist
 * - Finds an available localhost port for the Next.js dev server
 * - Syncs NEXT_PUBLIC_APP_URL, PORT, and WEB_PORT across env files
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const rootDir = path.join(__dirname, '..');
const envFile = path.join(rootDir, '.env');
const envLocalFile = path.join(rootDir, '.env.local');

const MAX_PORT = 65_535;
// Preview servers (per-project) dynamic pool
const FALLBACK_PORT_START = 3_100;
const FALLBACK_PORT_END = 3_999;
const DEFAULT_RANGE_SPAN = FALLBACK_PORT_END - FALLBACK_PORT_START;
// Claudable (root web app) default port and small scan span to avoid preview pool
const DEFAULT_WEB_PORT = 3_000;
const DEFAULT_WEB_SCAN_SPAN = 99; // scan up to 3099 at most
const DEFAULT_WEB_MAX = DEFAULT_WEB_PORT + DEFAULT_WEB_SCAN_SPAN;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function writeFileSafe(filePath, contents) {
  if (!contents.endsWith('\n')) {
    contents += '\n';
  }
  fs.writeFileSync(filePath, contents, 'utf8');
}

function upsertEnvValue(contents, key, value) {
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
  if (pattern.test(contents)) {
    return contents.replace(pattern, `${key}=${value}`);
  }

  if (contents.length && !contents.endsWith('\n')) {
    contents += '\n';
  }

  return contents + `${key}=${value}\n`;
}

function extractPort(contents, keys) {
  for (const key of keys) {
    const pattern = new RegExp(
      `^${escapeRegExp(key)}=["']?([0-9]{2,5})["']?$`,
      'm'
    );
    const match = contents.match(pattern);
    if (match) {
      const port = Number.parseInt(match[1], 10);
      if (!Number.isNaN(port) && port > 0 && port <= MAX_PORT) {
        return port;
      }
    }
  }
  return null;
}

function parsePortValue(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric) || numeric <= 0 || numeric > MAX_PORT) {
    return null;
  }
  return numeric;
}

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cleanup = (available) => {
      socket.removeAllListeners();
      try {
        socket.end();
        socket.destroy();
      } catch (_) {
        // no-op
      }
      resolve(available);
    };

    socket.once('connect', () => cleanup(false));
    socket.once('error', () => cleanup(true));
    socket.setTimeout(500, () => cleanup(true));
  });
}

async function isPortAvailable(port) {
  const results = await Promise.allSettled([
    checkPort('127.0.0.1', port),
    checkPort('::1', port),
  ]);

  // Treat IPv6 errors (e.g., not supported) as available
  return results.every((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return true;
  });
}

async function findAvailablePort(rangeStart, rangeEnd, preferredPort) {
  if (rangeStart > rangeEnd) {
    throw new Error(
      `Invalid port range: start ${rangeStart} is greater than end ${rangeEnd}.`
    );
  }

  const normalizedPreferred = Math.min(
    Math.max(preferredPort ?? rangeStart, rangeStart),
    rangeEnd
  );

  for (let port = normalizedPreferred; port <= rangeEnd; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  for (let port = rangeStart; port < normalizedPreferred; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new Error(
    `Could not find an available port between ${rangeStart} and ${rangeEnd}.`
  );
}

async function ensureEnvironment(options = {}) {
  console.log('🔧 Setting up development environment...');

  const { preferredPort: preferredOverride } = options ?? {};

  const envContents = readFileSafe(envFile);
  const envLocalContentsRaw = readFileSafe(envLocalFile);

  const portStartCandidates = [
    parsePortValue(process.env.PREVIEW_PORT_START),
    extractPort(envContents, ['PREVIEW_PORT_START']),
  ];

  let portRangeStart =
    portStartCandidates.find((value) => value !== null) ?? FALLBACK_PORT_START;

  const portEndCandidates = [
    parsePortValue(process.env.PREVIEW_PORT_END),
    extractPort(envContents, ['PREVIEW_PORT_END']),
  ];

  let portRangeEnd =
    portEndCandidates.find((value) => value !== null) ?? FALLBACK_PORT_END;

  if (portRangeEnd < portRangeStart) {
    portRangeEnd = Math.min(
      MAX_PORT,
      portRangeStart + DEFAULT_RANGE_SPAN
    );
  }

  const overridePreferred =
    preferredOverride !== undefined && preferredOverride !== null
      ? parsePortValue(String(preferredOverride))
      : null;

  const sanitizeWebCandidate = (val) => {
    if (val === null || val === undefined) return null;
    if (val >= portRangeStart && val <= portRangeEnd) return null;
    if (val < DEFAULT_WEB_PORT || val > DEFAULT_WEB_MAX) {
      return DEFAULT_WEB_PORT;
    }
    return val;
  };

  const preferredPortCandidates = [
    sanitizeWebCandidate(overridePreferred),
    sanitizeWebCandidate(parsePortValue(process.env.WEB_PORT)),
    sanitizeWebCandidate(parsePortValue(process.env.PORT)),
    sanitizeWebCandidate(extractPort(envContents, ['PORT', 'WEB_PORT'])),
  ];

  let preferredPort =
    preferredPortCandidates.find((value) => value !== null) ?? DEFAULT_WEB_PORT;

  // Compute scan window for WEB app: stay below preview range when possible
  let webRangeStart = preferredPort;
  let webRangeEnd = Math.min(
    preferredPort + DEFAULT_WEB_SCAN_SPAN,
    portRangeStart > preferredPort ? portRangeStart - 1 : preferredPort + DEFAULT_WEB_SCAN_SPAN
  );
  if (webRangeEnd < webRangeStart) {
    webRangeEnd = webRangeStart;
  }

  const port = await findAvailablePort(webRangeStart, webRangeEnd, preferredPort);
  const url = `http://localhost:${port}`;

  if (port !== preferredPort) {
    console.log(
      `⚠️  Port ${preferredPort} is busy. Switching to available port ${port} within ${webRangeStart}-${webRangeEnd}.`
    );
  } else {
    console.log(
      `✅ Using port ${port} (range ${webRangeStart}-${webRangeEnd}).`
    );
  }

  const envUpdates = {
    PORT: String(port),
    WEB_PORT: String(port),
    NEXT_PUBLIC_APP_URL: `"${url}"`,
    PREVIEW_PORT_START: String(portRangeStart),
    PREVIEW_PORT_END: String(portRangeEnd),
  };

  let updatedEnv = envContents || '# Auto-generated defaults - customize as needed\n';
  for (const [key, value] of Object.entries(envUpdates)) {
    updatedEnv = upsertEnvValue(updatedEnv, key, value);
  }
  writeFileSafe(envFile, updatedEnv);
  console.log(`📝 Updated ${path.relative(rootDir, envFile)}`);

  let envLocalContents = envLocalContentsRaw;
  if (!envLocalContents.trim()) {
    envLocalContents = '# Auto-generated by scripts/setup-env.js\n';
  }

  const envLocalUpdates = {
    NEXT_PUBLIC_APP_URL: url,
    PORT: String(port),
    WEB_PORT: String(port),
    PREVIEW_PORT_START: String(portRangeStart),
    PREVIEW_PORT_END: String(portRangeEnd),
  };

  for (const [key, value] of Object.entries(envLocalUpdates)) {
    envLocalContents = upsertEnvValue(envLocalContents, key, value);
  }
  writeFileSafe(envLocalFile, envLocalContents);
  console.log(`📝 Updated ${path.relative(rootDir, envLocalFile)}`);

  console.log('✅ Environment ready!');
  return { port, url };
}

if (require.main === module) {
  ensureEnvironment().catch((error) => {
    console.error('❌ Failed to set up environment.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = { ensureEnvironment };
