const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const isDev = process.env.NODE_ENV === 'development'

let mainWindow
let apiProcess

function createWindow() {
  // Use appropriate icon for each platform
  let iconPath
  if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, '../public/icon.icns')
  } else if (process.platform === 'win32') {
    iconPath = path.join(__dirname, '../public/icon.ico')
  } else {
    iconPath = path.join(__dirname, '../public/icon.png')
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    // Try port 3001 first (Next.js usually uses this when 3000 is busy)
    const loadDevServer = async () => {
      try {
        await mainWindow.loadURL('http://localhost:3001')
        console.log('Loaded from port 3001')
      } catch (error) {
        console.log('Port 3001 failed, trying port 3000...')
        try {
          await mainWindow.loadURL('http://localhost:3000')
          console.log('Loaded from port 3000')
        } catch (error2) {
          console.error('Failed to load from both ports:', error2)
        }
      }
    }
    loadDevServer()
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// Menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow.webContents.send('menu-new')
        }
      },
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          mainWindow.webContents.send('menu-open')
        }
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          mainWindow.webContents.send('menu-save')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit()
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
      { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
      { type: 'separator' },
      { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
      { type: 'separator' },
      { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
      { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://github.com/jkneen/flows')
        }
      }
    ]
  }
]

// macOS specific menu adjustments
if (process.platform === 'darwin') {
  menuTemplate.unshift({
    label: app.getName(),
    submenu: [
      { label: 'About ' + app.getName(), role: 'about' },
      { type: 'separator' },
      { label: 'Services', role: 'services', submenu: [] },
      { type: 'separator' },
      { label: 'Hide ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
      { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideothers' },
      { label: 'Show All', role: 'unhide' },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
    ]
  })
}

// Function to start the Python API server
function startAPIServer() {
  return new Promise((resolve, reject) => {
    const apiPath = isDev
      ? path.join(__dirname, '..', '..', '..', 'api')
      : path.join(process.resourcesPath, 'api')

    const pythonPath = isDev
      ? path.join(apiPath, '.venv', 'bin', 'python')
      : 'python3' // In production, we'll bundle Python or use system Python

    console.log('Starting API server from:', apiPath)
    console.log('Using Python at:', pythonPath)

    // Check if Python venv exists
    const fs = require('fs')
    if (!fs.existsSync(pythonPath)) {
      console.error('Python virtual environment not found at:', pythonPath)
      console.log('API server will not be started - app may have limited functionality')
      resolve()
      return
    }

    // Start the API server
    apiProcess = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8081'], {
      cwd: apiPath,
      env: {
        ...process.env,
        PYTHONPATH: apiPath,
        PYTHONUNBUFFERED: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']  // Capture stdout and stderr
    })

    apiProcess.stdout.on('data', (data) => {
      console.log(`API: ${data}`)
      // Check if server is ready
      if (data.toString().includes('Uvicorn running on')) {
        resolve()
      }
    })

    apiProcess.stderr.on('data', (data) => {
      console.error(`API Error: ${data}`)
    })

    apiProcess.on('close', (code) => {
      console.log(`API server exited with code ${code}`)
      apiProcess = null
    })

    // Give the server time to start
    setTimeout(() => {
      resolve()
    }, 3000)
  })
}

app.whenReady().then(async () => {
  // Start API server first
  try {
    console.log('Starting API server...')
    await startAPIServer()
    console.log('API server started successfully')
  } catch (error) {
    console.error('Failed to start API server:', error)
    // Continue anyway - app might work without API
  }

  createWindow()

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Clean up API server
  if (apiProcess) {
    console.log('Stopping API server...')
    apiProcess.kill()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
app.on('before-quit', () => {
  if (apiProcess) {
    console.log('Stopping API server before quit...')
    apiProcess.kill()
  }
})

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })
})