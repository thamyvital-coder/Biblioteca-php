const { app, BrowserWindow } = require('electron');
const { createServer } = require('./server.cjs');
let server;
async function openGame() {
  server = await createServer({ port: 0 });
  const win = new BrowserWindow({
    width: 720, height: 1280, minWidth: 450, minHeight: 700,
    backgroundColor: '#02091f', autoHideMenuBar: true,
    title: 'Brasília Fighter — TikTok LIVE Edition',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  await win.loadURL(`http://127.0.0.1:${server.address().port}`);
}
app.whenReady().then(openGame).catch(e => { console.error(e); app.quit(); });
app.on('window-all-closed', () => { if (server) server.close(); if (process.platform !== 'darwin') app.quit(); });
