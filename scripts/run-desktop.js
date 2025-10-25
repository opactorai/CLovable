#!/usr/bin/env node

/**
 * Electron + Next.js 개발 런처
 * - Next 개발 서버를 기동한 뒤 Electron 프로세스를 연결
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');

const { parseCliArgs, startWebDevServer } = require('./run-web');

const rootDir = path.join(__dirname, '..');
const isWindows = os.platform() === 'win32';

function waitForUrl(targetUrl, timeoutMs = 30_000, intervalMs = 300) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const { protocol } = new URL(targetUrl);
    const requester = protocol === 'https:' ? https : http;

    const check = () => {
      const request = requester
        .get(targetUrl, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
            resolve();
          } else if (Date.now() - start >= timeoutMs) {
            reject(new Error(`Timed out waiting for ${targetUrl} to become ready.`));
          } else {
            setTimeout(check, intervalMs);
          }
        })
        .on('error', () => {
          if (Date.now() - start >= timeoutMs) {
            reject(new Error(`Timed out waiting for ${targetUrl} to become ready.`));
          } else {
            setTimeout(check, intervalMs);
          }
        });

      request.setTimeout(intervalMs, () => {
        request.destroy();
      });
    };

    check();
  });
}

async function start() {
  const argv = process.argv.slice(2);
  const { preferredPort, passthrough } = parseCliArgs(argv);

  const { child: nextProcess, port, url } = await startWebDevServer({
    preferredPort,
    passthrough,
    stdio: 'inherit',
  });

  const electronBinary = path.join(
    rootDir,
    'node_modules',
    '.bin',
    isWindows ? 'electron.cmd' : 'electron'
  );

  await waitForUrl(url).catch((error) => {
    console.warn('⚠️  Next.js 개발 서버 준비 확인 중 경고:', error.message);
  });

  const electronEnv = {
    ...process.env,
    NODE_ENV: 'development',
    ELECTRON_START_URL: url,
    NEXT_PUBLIC_APP_URL: url,
    WEB_PORT: String(port),
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: '1',
  };

  console.log('🪟 Launching Electron renderer…');

  const electronArgs = [path.join(rootDir, 'electron', 'main.js'), ...passthrough];
  const electronProcess = spawn(electronBinary, electronArgs, {
    cwd: rootDir,
    env: electronEnv,
    stdio: 'inherit',
    shell: isWindows,
  });

  const shutdown = (exitCode = 0) => {
    if (!nextProcess.killed) {
      nextProcess.kill('SIGTERM');
    }
    if (!electronProcess.killed) {
      electronProcess.kill('SIGTERM');
    }
    process.exit(exitCode);
  };

  electronProcess.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) {
      console.error(`❌ Electron 프로세스가 코드 ${code}로 종료되었습니다.`);
    }
    shutdown(code ?? 0);
  });

  electronProcess.on('error', (error) => {
    console.error('❌ Electron 실행 중 오류가 발생했습니다.');
    console.error(error instanceof Error ? error.message : error);
    shutdown(1);
  });

  nextProcess.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) {
      console.error(`❌ Next.js 개발 서버가 코드 ${code}로 종료되었습니다.`);
    }
    if (!electronProcess.killed) {
      electronProcess.kill('SIGTERM');
    }
  });

  const handleSignal = (signal) => {
    console.log(`\n🛑 수신된 시그널: ${signal}. 프로세스를 종료합니다.`);
    shutdown(0);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

start().catch((error) => {
  console.error('\n❌ 데스크톱 개발 환경을 시작하지 못했습니다.');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
