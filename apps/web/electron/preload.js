const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  send: (channel, data) => {
    const validChannels = ['menu-new', 'menu-open', 'menu-save']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // Receive messages from main process
  on: (channel, func) => {
    const validChannels = ['menu-new', 'menu-open', 'menu-save']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    const validChannels = ['menu-new', 'menu-open', 'menu-save']
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel)
    }
  },

  // Platform info
  platform: process.platform,

  // App version
  appVersion: process.env.npm_package_version || '1.0.0'
})