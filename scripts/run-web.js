#!/usr/bin/env node

/**
 * Next.js development server launcher with automatic port management.
 * Expects scripts/setup-env.js to have been executed beforehand.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const { ensureEnvironment } = require('./setup-env');
const { PrismaClient } = require('@prisma/client');

const rootDir = path.join(__dirname, '..');
const isWindows = os.platform() === 'win32';

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, '.env.local') });

function parseCliArgs(argv) {
  const passthrough = [];
  let preferredPort;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--port' || arg === '-p') {
      const value = argv[i + 1];
      if (value && !value.startsWith('-')) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          preferredPort = parsed;
        }
        i += 1;
        continue;
      }
    } else if (arg.startsWith('--port=')) {
      const value = arg.slice('--port='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        preferredPort = parsed;
      }
      continue;
    } else if (arg.startsWith('-p=')) {
      const value = arg.slice('-p='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        preferredPort = parsed;
      }
      continue;
    }

    passthrough.push(arg);
  }

  return { preferredPort, passthrough };
}

function runPrismaDbPush() {
  return new Promise((resolve, reject) => {
    console.log('🗃️  Synchronizing Prisma schema (prisma db push)...');
    const child = spawn('npx', ['prisma', 'db', 'push'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: isWindows,
      env: {
        ...process.env,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`prisma db push exited with code ${code ?? 'unknown'}`)
        );
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function ensureDatabaseSynced() {
  if (process.env.SKIP_DB_SYNC === '1') {
    return;
  }

  let prisma;
  try {
    prisma = new PrismaClient();
  } catch (error) {
    console.warn(
      '⚠️  Failed to initialize Prisma Client, attempting to sync automatically:',
      error instanceof Error ? error.message : error
    );
    await runPrismaDbPush();
    return;
  }

  try {
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'`;
    if (!Array.isArray(tables) || tables.length === 0) {
      await runPrismaDbPush();
    }
  } catch (error) {
    console.warn(
      '⚠️  Prisma schema check failed, attempting to sync automatically:',
      error instanceof Error ? error.message : error
    );
    await runPrismaDbPush();
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

async function startWebDevServer({
  preferredPort,
  passthrough = [],
  stdio = 'inherit',
} = {}) {
  const { port, url } = await ensureEnvironment({
    preferredPort,
  });

  await ensureDatabaseSynced();

  const resolvedPort = port;
  const resolvedUrl = url;

  process.env.PORT = resolvedPort.toString();
  process.env.WEB_PORT = resolvedPort.toString();
  process.env.NEXT_PUBLIC_APP_URL = resolvedUrl;

  console.log(`🚀 Starting Next.js dev server on ${resolvedUrl}`);

  const child = spawn(
    'npx',
    ['next', 'dev', '--port', resolvedPort.toString(), ...passthrough],
    {
      cwd: rootDir,
      stdio,
      shell: isWindows,
      env: {
        ...process.env,
        PORT: resolvedPort.toString(),
        WEB_PORT: resolvedPort.toString(),
        NEXT_PUBLIC_APP_URL: resolvedUrl,
        BROWSER: process.env.BROWSER || 'none',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    }
  );

  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    child.once('error', handleError);
    child.once('spawn', () => {
      child.removeListener('error', handleError);
      resolve();
    });
  });

  return { child, port: resolvedPort, url: resolvedUrl };
}

async function runFromCli() {
  const argv = process.argv.slice(2);
  const { preferredPort, passthrough } = parseCliArgs(argv);

  const { child } = await startWebDevServer({
    preferredPort,
    passthrough,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error('\n❌ Failed to start Next.js dev server');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) {
      console.error(`\n❌ Next.js dev server exited with code ${code}`);
      process.exit(code);
    }
  });
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error('\n❌ Failed to launch dev server');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  parseCliArgs,
  startWebDevServer,
};
