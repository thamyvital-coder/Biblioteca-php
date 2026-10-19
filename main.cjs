const { app, BrowserWindow, Menu } = require('electron');
const { createServer } = require('./server.cjs');

let server;
let windowRef;

async function createWindow() {
  Menu.setApplicationMenu(null);
  server = await createServer({ port: 0 });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  windowRef = new BrowserWindow({
    title: 'Brasília Fighter — Jogo da LIVE',
    width: 540,
    height: 960,
    minWidth: 320,
    minHeight: 560,
    backgroundColor: '#090d1c',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });

  windowRef.setAspectRatio(9 / 16);
  windowRef.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  windowRef.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(url)) event.preventDefault();
  });
  await windowRef.loadURL(url);
  windowRef.on('closed', () => { windowRef = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (server?.close) server.close(); });
