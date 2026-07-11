'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dockerService = require('./docker-service.cjs');
const composeService = require('./compose-service.cjs');

// Permite isolar os dados do app durante os testes E2E
if (process.env.DOCKDESK_USERDATA) {
  app.setPath('userData', process.env.DOCKDESK_USERDATA);
}

let mainWindow = null;

// ---------- Configuração persistente ----------

function configPath() {
  return path.join(app.getPath('userData'), 'dockdesk-config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (_) {
    return { composeFolders: [] };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

// ---------- Janela ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: 'DockDesk',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ---------- IPC: engine e containers ----------

ipcMain.handle('engine:ping', () => dockerService.ping());
ipcMain.handle('containers:list', () => dockerService.listContainers());
ipcMain.handle('containers:action', (_e, id, action) =>
  dockerService.containerAction(id, action)
);
ipcMain.handle('containers:inspect', (_e, id) => dockerService.inspectContainer(id));
ipcMain.handle('containers:stats', () => dockerService.getStats());

// ---------- IPC: exec / shells ----------

ipcMain.handle('shells:detect', (_e, id) => dockerService.detectShells(id));
ipcMain.handle('exec:command', (_e, id, cmd) => dockerService.execCommand(id, cmd));

// ---------- IPC: terminal interativo ----------

ipcMain.handle('term:open', async (event, id, shell, termId) => {
  const wc = event.sender;
  await dockerService.openTerminal(
    id,
    shell,
    termId,
    (chunk) => {
      if (!wc.isDestroyed()) wc.send(`term:data:${termId}`, chunk);
    },
    () => {
      if (!wc.isDestroyed()) wc.send(`term:exit:${termId}`);
    }
  );
  return termId;
});
ipcMain.on('term:write', (_e, termId, data) => dockerService.writeTerminal(termId, data));
ipcMain.on('term:resize', (_e, termId, cols, rows) =>
  dockerService.resizeTerminal(termId, cols, rows)
);
ipcMain.on('term:close', (_e, termId) => dockerService.closeTerminal(termId));

// ---------- IPC: logs ----------

ipcMain.handle('logs:start', async (event, id) => {
  const wc = event.sender;
  await dockerService.startLogs(id, (text) => {
    if (!wc.isDestroyed()) wc.send(`logs:data:${id}`, text);
  });
  return true;
});
ipcMain.on('logs:stop', (_e, id) => dockerService.stopLogs(id));

// ---------- IPC: imagens ----------

ipcMain.handle('images:list', () => dockerService.listImages());
ipcMain.handle('images:remove', (_e, id) => dockerService.removeImage(id));

// ---------- IPC: compose ----------

ipcMain.handle('compose:folders', () => loadConfig().composeFolders);

ipcMain.handle('compose:addFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha a pasta dos seus projetos',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return addComposeFolder(result.filePaths[0]);
});

function addComposeFolder(folder) {
  const config = loadConfig();
  if (!config.composeFolders.includes(folder)) {
    config.composeFolders.push(folder);
    saveConfig(config);
  }
  return config.composeFolders;
}

ipcMain.handle('compose:addFolderPath', (_e, folder) => addComposeFolder(folder));

ipcMain.handle('compose:removeFolder', (_e, folder) => {
  const config = loadConfig();
  config.composeFolders = config.composeFolders.filter((f) => f !== folder);
  saveConfig(config);
  return config.composeFolders;
});

ipcMain.handle('compose:scan', () =>
  composeService.scanProjects(loadConfig().composeFolders)
);

ipcMain.handle('compose:status', (_e, file) => composeService.projectStatus(file));

let composeRunCounter = 0;
ipcMain.handle('compose:run', async (event, file, action) => {
  const runId = `run-${++composeRunCounter}`;
  const wc = event.sender;
  const argsByAction = {
    up: ['up', '-d'],
    down: ['down'],
    restart: ['restart'],
    pull: ['pull'],
  };
  const args = argsByAction[action];
  if (!args) throw new Error(`Ação compose desconhecida: ${action}`);

  // roda em segundo plano; envia saída e término via eventos
  composeService
    .runCompose(file, args, (text) => {
      if (!wc.isDestroyed()) wc.send(`compose:output:${runId}`, text);
    })
    .then(({ exitCode }) => {
      if (!wc.isDestroyed()) wc.send(`compose:done:${runId}`, exitCode);
    });
  return runId;
});

// ---------- Ciclo de vida ----------

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
