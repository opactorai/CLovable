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

const rootDir = path.join(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const preloadPath = path.join(__dirname, 'preload.js');

function waitForUrl(targetUrl, timeoutMs = 30_000, intervalMs = 200) {
  const { protocol } = new URL(targetUrl);
  const requester = protocol === 'https:' ? https : http;
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = requester
        .get(targetUrl, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
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
  const serverPath = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      'The Next.js standalone server file is missing. Run `npm run build` and try again.'
    );
  }
  return serverPath;
}

async function startProductionServer() {
  if (productionUrl) {
    return productionUrl;
  }

  const serverPath = ensureStandaloneArtifacts();
  const startPort =
    Number.parseInt(process.env.WEB_PORT || process.env.PORT || '3000', 10) || 3000;
  const port = await findAvailablePort(startPort);
  const url = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: '1',
  };

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });

  nextServerProcess.on('exit', (code, signal) => {
    if (!shuttingDown && typeof code === 'number' && code !== 0) {
      console.error(`⚠️  Next.js server exited with code ${code} (signal: ${signal ?? 'n/a'}).`);
    }
    nextServerProcess = null;
  });

  await waitForUrl(url).catch((error) => {
    console.error('❌ The Next.js production server failed to start.');
    throw error;
  });

  productionUrl = url;
  return productionUrl;
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

  const startUrl = isDev
    ? process.env.ELECTRON_START_URL || `http://localhost:${process.env.WEB_PORT || '3000'}`
    : await startProductionServer();

  let loadError = null;
  try {
    await mainWindow.loadURL(startUrl);
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Failed to load start URL in Electron window:', loadError);
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
    console.error(`❌ Failed to load ${validatedURL || startUrl}: [${errorCode}] ${errorDescription}`);
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
      console.error('❌ Failed to recreate the main window.');
      console.error(error instanceof Error ? error.stack || error.message : error);
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
      console.error('❌ An error occurred while initializing the Electron app.');
      console.error(error instanceof Error ? error.stack || error.message : error);
      app.quit();
    });
}
