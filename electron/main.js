const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let nextServerProcess = null;
let productionUrl = null;
let shuttingDown = false;

// Lightweight file logger to help diagnose startup issues when app quits early
const customLogFile = process.env.CLAUDABLE_LOG_FILE;
const logsDir = (() => {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (_) {
    return os.tmpdir();
  }
})();
const logFile = customLogFile ? (() => { try { fs.mkdirSync(path.dirname(customLogFile), { recursive: true }); } catch (_) {} return customLogFile; })() : path.join(logsDir, 'main.log');
function log(...args) {
  const msg = [
    new Date().toISOString(),
    '-',
    ...args.map((a) => (typeof a === 'string' ? a : (() => {
      try { return JSON.stringify(a); } catch { return String(a); }
    })())),
  ].join(' ');
  try { fs.appendFileSync(logFile, msg + '\n'); } catch (_) {}
  // Also mirror to console for dev runs
  // eslint-disable-next-line no-console
  console.log(msg);
}

// Resolve project root differently when packaged (ASAR) so Next server can chdir
let rootDir = path.join(__dirname, '..');
if (rootDir.includes('app.asar')) {
  const unpacked = rootDir.replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) {
    rootDir = unpacked;
  }
}
const standaloneDir = path.join(rootDir, '.next', 'standalone');
log('Startup context', JSON.stringify({ __dirname, rootDir, standaloneDir, isDev }));
const preloadPath = path.join(__dirname, 'preload.js');

function waitForUrl(targetUrl, options = {}) {
  const {
    timeoutMs = 30_000,
    intervalMs = 200,
    isAborted,
  } = options ?? {};
  const { protocol } = new URL(targetUrl);
  const requester = protocol === 'https:' ? https : http;
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      if (typeof isAborted === 'function' && isAborted()) {
        reject(new Error(`Aborted while waiting for ${targetUrl}`));
        return;
      }
      const request = requester
        .get(targetUrl, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
            if (typeof isAborted === 'function' && isAborted()) {
              reject(new Error(`Aborted while waiting for ${targetUrl}`));
              return;
            }
            resolve();
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            reject(new Error(`Timed out waiting for ${targetUrl}`));
          } else {
            setTimeout(poll, intervalMs);
          }
        })
        .on('error', () => {
          if (typeof isAborted === 'function' && isAborted()) {
            reject(new Error(`Aborted while waiting for ${targetUrl}`));
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            reject(new Error(`Timed out waiting for ${targetUrl}`));
          } else {
            setTimeout(poll, intervalMs);
          }
        });

      request.setTimeout(intervalMs, () => request.destroy());
    };

    poll();
  });
}

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester
          .once('close', () => resolve(true))
          .close();
      })
      .listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort = 3000, maxAttempts = 50) {
  let port = startPort;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1, port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await checkPortAvailability(port);
    if (available) {
      return port;
    }
  }

  throw new Error(
    `Failed to find available port starting at ${startPort}.`
  );
}

function ensureStandaloneArtifacts() {
  // Support both classic and nested standalone layouts (Next 13–15)
  const directServer = path.join(standaloneDir, 'server.js');
  if (fs.existsSync(directServer)) {
    log('Found standalone server at', directServer);
    return directServer;
  }

  // Try common nested layout: .next/standalone/<projectName>/server.js
  try {
    const entries = fs.readdirSync(standaloneDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(standaloneDir, entry.name, 'server.js');
        if (fs.existsSync(candidate)) {
          log('Found nested standalone server at', candidate);
          return candidate;
        }
      }
    }
  } catch (_) {
    // fallthrough to error below
  }

  throw new Error(
    'The Next.js standalone server file is missing. Run `npm run build` and try again.'
  );
}

async function startProductionServer() {
  if (productionUrl) {
    return productionUrl;
  }

  const serverPath = ensureStandaloneArtifacts();
  const startPort =
    Number.parseInt(process.env.WEB_PORT || process.env.PORT || '3000', 10) || 3000;
  const maxPortAttempts = 20;
  let portHint = startPort;
  let lastError = null;

  for (let attempt = 0; attempt < maxPortAttempts; attempt += 1) {
    let port;
    try {
      port = await findAvailablePort(portHint);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      break;
    }

    // Next attempt will start from the subsequent port to avoid tight loops.
    portHint = port + 1;
    const url = `http://127.0.0.1:${port}`;

    const env = {
      ...process.env,
      // Ensure Electron process runs the script as plain Node.js
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      NEXT_TELEMETRY_DISABLED: '1',
    };

    const cwd = path.dirname(serverPath);
    log(
      'Spawning Next server',
      JSON.stringify({ execPath: process.execPath, serverPath, cwd, port, attempt })
    );

    const child = spawn(process.execPath, [serverPath], {
      cwd,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });

    const processState = {
      exited: false,
      code: null,
      signal: null,
    };

    nextServerProcess = child;

    child.on('exit', (code, signal) => {
      processState.exited = true;
      processState.code = code;
      processState.signal = signal;
      if (!shuttingDown && typeof code === 'number' && code !== 0) {
        log(`⚠️  Next.js server exited with code ${code} (signal: ${signal ?? 'n/a'}).`);
      }
      if (nextServerProcess === child) {
        nextServerProcess = null;
      }
    });

    try {
      await waitForUrl(url, {
        isAborted: () => processState.exited,
      });

      if (processState.exited) {
        throw new Error(
          `Next.js server process exited before readiness (code=${processState.code ?? 'n/a'}, signal=${processState.signal ?? 'n/a'})`
        );
      }

      productionUrl = url;
      log('Next.js production server ready', JSON.stringify({ url, port }));
      return productionUrl;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log(
        'Failed to verify Next.js server readiness',
        String(lastError && (lastError.stack || lastError.message) || lastError),
        JSON.stringify({ port, attempt, exitCode: processState.code, exitSignal: processState.signal })
      );
      stopProductionServer();
    }
  }

  const failureMessage =
    lastError && lastError.message
      ? `Failed to start Next.js production server: ${lastError.message}`
      : 'Failed to start Next.js production server after multiple attempts.';
  const bootstrapError = new Error(failureMessage);
  if (lastError) {
    bootstrapError.cause = lastError;
  }
  throw bootstrapError;
}

function stopProductionServer() {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill('SIGTERM');
    nextServerProcess = null;
  }
  productionUrl = null;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#111827',
    titleBarStyle: os.platform() === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  let startUrl;
  try {
    startUrl = isDev
      ? process.env.ELECTRON_START_URL || `http://localhost:${process.env.WEB_PORT || '3000'}`
      : await startProductionServer();
  } catch (e) {
    log('Failed to start production server, falling back to error page.', String(e && (e.stack || e.message) || e));
    startUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!doctype html><html><body style="background:#111827;color:#fff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;">' +
      '<h2>Failed to start local server</h2>' +
      '<p>See log file for details:</p>' +
      `<code>${logFile}</code>` +
      '</body></html>'
    );
  }

  let loadError = null;
  try {
    log('Loading start URL', startUrl);
    await mainWindow.loadURL(startUrl);
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    log('❌ Failed to load start URL in Electron window:', String(loadError && loadError.stack || loadError));
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('🪟 Main window ready-to-show – displaying window.');
      mainWindow.show();
    }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('🪟 Main window did-finish-load – displaying window.');
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`❌ Failed to load ${validatedURL || startUrl}: [${errorCode}] ${errorDescription}`);
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('🪟 Showing fallback window after load failure.');
      mainWindow.show();
    }
  });

  if (loadError && mainWindow) {
    console.log('🪟 Showing window despite load error.');
    mainWindow.show();
  }

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('🪟 Timed show fallback – displaying window.');
      mainWindow.show();
    }
  }, 1500);

  if (isDev && process.env.ELECTRON_DEBUG_TOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach', activate: false });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('ping', async () => 'pong');
}

function setupSingleInstanceLock() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  return true;
}

app.disableHardwareAcceleration();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  shuttingDown = true;
  stopProductionServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      log('❌ Failed to recreate the main window.', String(error && error.stack || error));
    });
  }
});

if (setupSingleInstanceLock()) {
  app
    .whenReady()
    .then(() => {
      registerIpcHandlers();
      return createMainWindow();
    })
    .catch((error) => {
      log('❌ An error occurred while initializing the Electron app.', String(error && error.stack || error));
      app.quit();
    });
}

process.on('uncaughtException', (err) => {
  log('uncaughtException', String(err && (err.stack || err.message) || err));
});
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection', String(reason && (reason.stack || reason.message) || reason));
});
