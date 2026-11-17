// Electron shell for "The Last Way Out" (Ubuntu / Linux desktop).
// Serves the Vite build from a privileged app:// scheme so ES modules, dynamic imports and WebAudio work without file:// restrictions.
const { app, BrowserWindow, protocol, net, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const dist = path.join(__dirname, '..', 'dist')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// Sandbox policy: explicit TLWO_NO_SANDBOX wins. Otherwise keep the sandbox ON,
// but auto-detect the common Ubuntu/Debian case where Electron's chrome-sandbox
// helper is present yet not owned by root + setuid (Chromium aborts otherwise).
const envSandbox = process.env.TLWO_NO_SANDBOX
let noSandbox = envSandbox === '1'
if (!envSandbox && !app.isPackaged) {
  try {
    const helper = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'chrome-sandbox')
    const st = fs.statSync(helper)
    const configured = st.uid === 0 && (st.mode & 0o4000) !== 0
    if (!configured) {
      noSandbox = true
      console.warn('[TLWO] chrome-sandbox is not setuid-root (uid=' + st.uid + ', mode=' + (st.mode & 0o7777).toString(8) + '); starting with --no-sandbox.')
      console.warn('[TLWO] Proper fix: sudo chown root:root "' + helper + '" && sudo chmod 4755 "' + helper + '"')
    }
  } catch (e) {
    noSandbox = true
    console.warn('[TLWO] Could not verify chrome-sandbox (' + e.message + '); starting with --no-sandbox.')
  }
}
if (noSandbox) app.commandLine.appendSwitch('no-sandbox')

// No corsEnabled on the privileged file-serving scheme: it would allow cross-origin reads.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 500, backgroundColor: '#000000',
    title: 'The Last Way Out', autoHideMenuBar: true, fullscreenable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  Menu.setApplicationMenu(null)
  win.loadURL('app://game/index.html')
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault() }
    if (!app.isPackaged && input.key === 'F12' && input.control) win.webContents.toggleDevTools()
  })
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url)
    let p = decodeURIComponent(u.pathname)
    if (p === '/' || p === '') p = '/index.html'
    // Resolve + relative containment (startsWith on a joined path is bypassable by
    // sibling directories whose name begins with the dist directory name).
    const file = path.resolve(dist, '.' + p)
    const rel = path.relative(dist, file)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(file).toString())
  })
  ipcMain.on('quit', () => app.quit())
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => app.quit())
