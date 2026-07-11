'use strict';

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dockerService = require('./docker-service.cjs');
const composeService = require('./compose-service.cjs');

// Permite isolar os dados do app durante os testes E2E
if (process.env.DOCKDESK_USERDATA) {
  app.setPath('userData', process.env.DOCKDESK_USERDATA);
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// instância única: a segunda execução apenas traz a janela existente à frente
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}
app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, '..', 'build', 'tray.png');

// ---------- Configuração persistente ----------

function configPath() {
  return path.join(app.getPath('userData'), 'dockdesk-config.json');
}

function loadConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    return { composeFolders: [], routines: {}, ...config };
  } catch (_) {
    return { composeFolders: [], routines: {}, autostart: false, startHidden: false };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

// ---------- Autostart (XDG) ----------

function autostartFilePath() {
  return path.join(os.homedir(), '.config', 'autostart', 'dockdesk.desktop');
}

function autostartExecLine(startHidden) {
  // empacotado como AppImage o próprio arquivo é o executável;
  // em desenvolvimento usa o binário do electron + caminho do app
  const base = process.env.APPIMAGE
    ? `"${process.env.APPIMAGE}"`
    : `"${process.execPath}" "${app.getAppPath()}"`;
  return startHidden ? `${base} --hidden` : base;
}

function applyAutostart() {
  const config = loadConfig();
  const file = autostartFilePath();
  if (config.autostart) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=DockDesk',
        'Comment=Gerenciador gráfico de containers Docker',
        `Exec=${autostartExecLine(config.startHidden)}`,
        'X-GNOME-Autostart-enabled=true',
        'Terminal=false',
        '',
      ].join('\n')
    );
  } else {
    try {
      fs.unlinkSync(file);
    } catch (_) {}
  }
}

// ---------- Bandeja (tray) ----------

const TRAY_STRINGS = {
  pt: {
    toggle: 'Mostrar/Ocultar DockDesk',
    autostart: 'Iniciar com o sistema',
    hidden: 'Iniciar oculto (só na bandeja)',
    quit: 'Encerrar DockDesk',
  },
  en: {
    toggle: 'Show/Hide DockDesk',
    autostart: 'Start with the system',
    hidden: 'Start hidden (tray only)',
    quit: 'Quit DockDesk',
  },
  zh: {
    toggle: '显示/隐藏 DockDesk',
    autostart: '开机自启动',
    hidden: '启动时隐藏（仅托盘）',
    quit: '退出 DockDesk',
  },
  hi: {
    toggle: 'DockDesk दिखाएँ/छिपाएँ',
    autostart: 'सिस्टम के साथ शुरू करें',
    hidden: 'छिपा हुआ शुरू करें (केवल ट्रे)',
    quit: 'DockDesk बंद करें',
  },
  es: {
    toggle: 'Mostrar/Ocultar DockDesk',
    autostart: 'Iniciar con el sistema',
    hidden: 'Iniciar oculto (solo bandeja)',
    quit: 'Salir de DockDesk',
  },
  fr: {
    toggle: 'Afficher/Masquer DockDesk',
    autostart: 'Lancer au démarrage',
    hidden: 'Démarrer masqué (zone de notification)',
    quit: 'Quitter DockDesk',
  },
};

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const config = loadConfig();
  const t = TRAY_STRINGS[config.lang] || TRAY_STRINGS.pt;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t.toggle, click: toggleWindow },
      { type: 'separator' },
      {
        label: t.autostart,
        type: 'checkbox',
        checked: !!config.autostart,
        click: (item) => {
          const c = loadConfig();
          c.autostart = item.checked;
          saveConfig(c);
          applyAutostart();
          rebuildTrayMenu();
        },
      },
      {
        label: t.hidden,
        type: 'checkbox',
        checked: !!config.startHidden,
        click: (item) => {
          const c = loadConfig();
          c.startHidden = item.checked;
          saveConfig(c);
          applyAutostart();
          rebuildTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: t.quit,
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(TRAY_ICON_PATH);
    tray = new Tray(image);
    tray.setToolTip('DockDesk');
    tray.on('click', toggleWindow);
    rebuildTrayMenu();
  } catch (err) {
    // sem suporte a tray no ambiente (ex.: CI) — o app segue normal
    tray = null;
  }
}

// ---------- Janela ----------

function createWindow() {
  const startHidden = process.argv.includes('--hidden') || loadConfig().startHidden;
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: 'DockDesk',
    icon: nativeImage.createFromPath(ICON_PATH),
    show: !startHidden,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  // fechar a janela esconde para a bandeja; sair de verdade fica no menu da tray
  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
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

// ---------- IPC: volumes e redes ----------

ipcMain.handle('volumes:list', () => dockerService.listVolumes());
ipcMain.handle('volumes:remove', (_e, name) => dockerService.removeVolume(name));
ipcMain.handle('networks:list', () => dockerService.listNetworks());
ipcMain.handle('networks:remove', (_e, id) => dockerService.removeNetwork(id));

// ---------- IPC: preferências ----------

ipcMain.handle('settings:setLang', (_e, lang) => {
  const config = loadConfig();
  config.lang = lang;
  saveConfig(config);
  rebuildTrayMenu();
  return true;
});

// ---------- IPC: rotinas ----------

ipcMain.handle('routines:list', (_e, key) => loadConfig().routines[key] || []);
ipcMain.handle('routines:save', (_e, key, list) => {
  const config = loadConfig();
  config.routines[key] = list;
  saveConfig(config);
  return list;
});

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

app.whenReady().then(() => {
  createTray();
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  app.quit();
});
