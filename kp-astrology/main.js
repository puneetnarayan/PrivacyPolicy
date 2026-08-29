// Electron main process — wraps the existing HTML/CSS/JS app unchanged.
// No calculation logic lives here; this only creates the window and loads
// index.html, the same file that already runs standalone in any browser.

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'KP Astrology Analyzer',
    webPreferences: {
      // The app has no Node/IPC dependencies today (everything runs as plain
      // browser JS, same as the standalone version) — contextIsolation stays
      // on and nodeIntegration off, the safe Electron defaults, until a real
      // need (e.g. atomic update file replacement) requires a preload script.
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
