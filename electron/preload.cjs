'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('dockdesk', {
  engine: {
    ping: () => ipcRenderer.invoke('engine:ping'),
  },
  containers: {
    list: () => ipcRenderer.invoke('containers:list'),
    action: (id, action) => ipcRenderer.invoke('containers:action', id, action),
    inspect: (id) => ipcRenderer.invoke('containers:inspect', id),
    stats: () => ipcRenderer.invoke('containers:stats'),
  },
  shells: {
    detect: (id) => ipcRenderer.invoke('shells:detect', id),
  },
  exec: {
    command: (id, cmd) => ipcRenderer.invoke('exec:command', id, cmd),
  },
  term: {
    open: (id, shell, termId) => ipcRenderer.invoke('term:open', id, shell, termId),
    write: (termId, data) => ipcRenderer.send('term:write', termId, data),
    resize: (termId, cols, rows) => ipcRenderer.send('term:resize', termId, cols, rows),
    close: (termId) => ipcRenderer.send('term:close', termId),
    onData: (termId, cb) => subscribe(`term:data:${termId}`, cb),
    onExit: (termId, cb) => subscribe(`term:exit:${termId}`, cb),
  },
  logs: {
    start: (id) => ipcRenderer.invoke('logs:start', id),
    stop: (id) => ipcRenderer.send('logs:stop', id),
    onData: (id, cb) => subscribe(`logs:data:${id}`, cb),
  },
  images: {
    list: () => ipcRenderer.invoke('images:list'),
    remove: (id) => ipcRenderer.invoke('images:remove', id),
  },
  compose: {
    folders: () => ipcRenderer.invoke('compose:folders'),
    addFolder: () => ipcRenderer.invoke('compose:addFolder'),
    addFolderPath: (folder) => ipcRenderer.invoke('compose:addFolderPath', folder),
    removeFolder: (folder) => ipcRenderer.invoke('compose:removeFolder', folder),
    scan: () => ipcRenderer.invoke('compose:scan'),
    status: (file) => ipcRenderer.invoke('compose:status', file),
    run: (file, action) => ipcRenderer.invoke('compose:run', file, action),
    onOutput: (runId, cb) => subscribe(`compose:output:${runId}`, cb),
    onDone: (runId, cb) => subscribe(`compose:done:${runId}`, cb),
  },
});
