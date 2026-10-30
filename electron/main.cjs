// Low Front desktop app (plan section 15, Phase 10): the web build in an Electron window.
const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const SCHEME = 'app';

// Laptops with a built-in and a dedicated GPU: render on the dedicated one.
app.commandLine.appendSwitch('force_high_performance_gpu');

// The game is served from app://game/ rather than file://: ES modules and the physics wasm load
// normally, and the origin never changes, so localStorage saves survive app updates.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function serveDist() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1117',
    title: 'Low Front',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  // F11 toggles fullscreen (there is no menu bar to do it from).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.loadURL(`${SCHEME}://game/index.html${process.env.LOWFRONT_QUERY ?? ''}`);
  return win;
}

// One copy at a time: a second launch focuses the running window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  ipcMain.on('lowfront:quit', () => app.quit());
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    serveDist();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
