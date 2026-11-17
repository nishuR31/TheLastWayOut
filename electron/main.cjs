// Electron shell for "The Last Way Out" (Ubuntu / Linux desktop).
// Serves the Vite build from a privileged app:// scheme so ES modules, dynamic imports and WebAudio work without file:// restrictions.
const { app, BrowserWindow, protocol, net, ipcMain, Menu } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

const dist = path.join(__dirname, '..', 'dist')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// Ubuntu 23.10+ restricts unprivileged user namespaces. The sandbox stays ON by
// default; opt out explicitly with TLWO_NO_SANDBOX=1 only if Electron cannot start.
if (process.env.TLWO_NO_SANDBOX === '1') app.commandLine.appendSwitch('no-sandbox')

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
