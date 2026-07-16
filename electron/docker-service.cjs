'use strict';

const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// ---------- Engine ----------

async function ping() {
  try {
    const v = await docker.version();
    return { ok: true, version: v.Version, apiVersion: v.ApiVersion };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------- Containers ----------

function simplifyPorts(ports) {
  if (!ports) return [];
  const seen = new Set();
  const out = [];
  for (const p of ports) {
    const key = `${p.PublicPort || ''}:${p.PrivatePort}/${p.Type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      public: p.PublicPort || null,
      private: p.PrivatePort,
      type: p.Type,
    });
  }
  return out.sort((a, b) => (a.private || 0) - (b.private || 0));
}

async function listContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((c) => ({
    id: c.Id,
    shortId: c.Id.slice(0, 12),
    name: (c.Names && c.Names[0] ? c.Names[0] : '').replace(/^\//, ''),
    image: c.Image,
    state: c.State, // running, exited, paused, created...
    status: c.Status,
    created: c.Created,
    ports: simplifyPorts(c.Ports),
    composeProject: (c.Labels && c.Labels['com.docker.compose.project']) || null,
    composeService: (c.Labels && c.Labels['com.docker.compose.service']) || null,
    composeWorkingDir:
      (c.Labels && c.Labels['com.docker.compose.project.working_dir']) || null,
  }));
}

async function containerAction(id, action) {
  const container = docker.getContainer(id);
  switch (action) {
    case 'start':
      await container.start();
      break;
    case 'stop':
      await container.stop({ t: 10 });
      break;
    case 'restart':
      await container.restart({ t: 10 });
      break;
    case 'pause':
      await container.pause();
      break;
    case 'unpause':
      await container.unpause();
      break;
    case 'remove':
      await container.remove({ force: true });
      break;
    default:
      throw new Error(`Ação desconhecida: ${action}`);
  }
  return { ok: true };
}

async function inspectContainer(id) {
  const data = await docker.getContainer(id).inspect();
  return {
    id: data.Id,
    name: data.Name.replace(/^\//, ''),
    image: data.Config.Image,
    created: data.Created,
    state: data.State,
    restartCount: data.RestartCount,
    platform: data.Platform,
    env: data.Config.Env || [],
    cmd: data.Config.Cmd,
    entrypoint: data.Config.Entrypoint,
    workingDir: data.Config.WorkingDir,
    mounts: (data.Mounts || []).map((m) => ({
      type: m.Type,
      source: m.Source || m.Name || '',
      destination: m.Destination,
      rw: m.RW,
    })),
    networks: Object.keys(data.NetworkSettings.Networks || {}),
    ipAddress:
      Object.values(data.NetworkSettings.Networks || {})
        .map((n) => n.IPAddress)
        .filter(Boolean)[0] || null,
    ports: data.NetworkSettings.Ports || {},
  };
}

// ---------- Stats ----------

function computeCpuPercent(stats) {
  try {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpus =
      stats.cpu_stats.online_cpus ||
      (stats.cpu_stats.cpu_usage.percpu_usage || []).length ||
      1;
    if (sysDelta > 0 && cpuDelta >= 0) {
      return (cpuDelta / sysDelta) * cpus * 100;
    }
  } catch (_) {
    /* stats incompletos em containers recém-criados */
  }
  return 0;
}

function computeMem(stats) {
  try {
    const usage = stats.memory_stats.usage || 0;
    const cache =
      (stats.memory_stats.stats &&
        (stats.memory_stats.stats.inactive_file || stats.memory_stats.stats.cache)) ||
    0;
    const limit = stats.memory_stats.limit || 0;
    return { used: Math.max(usage - cache, 0), limit };
  } catch (_) {
    return { used: 0, limit: 0 };
  }
}

async function getStats() {
  const running = await docker.listContainers();
  const results = await Promise.all(
    running.map(async (c) => {
      try {
        const stats = await docker.getContainer(c.Id).stats({ stream: false });
        const mem = computeMem(stats);
        let netRx = 0;
        let netTx = 0;
        for (const net of Object.values(stats.networks || {})) {
          netRx += net.rx_bytes || 0;
          netTx += net.tx_bytes || 0;
        }
        return [
          c.Id,
          {
            cpu: computeCpuPercent(stats),
            memUsed: mem.used,
            memLimit: mem.limit,
            netRx,
            netTx,
          },
        ];
      } catch (_) {
        return null;
      }
    })
  );
  return Object.fromEntries(results.filter(Boolean));
}

// ---------- Exec / shells ----------

const SHELL_CANDIDATES = ['bash', 'zsh', 'fish', 'ash', 'dash', 'ksh', 'tcsh', 'sh'];

async function detectShells(id) {
  const script = SHELL_CANDIDATES.map(
    (s) => `command -v ${s} >/dev/null 2>&1 && echo ${s}`
  ).join('; ');
  try {
    const { output } = await execCommand(id, script);
    const found = output
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => SHELL_CANDIDATES.includes(l));
    return [...new Set(found)];
  } catch (_) {
    return [];
  }
}

async function execCommand(id, cmd, timeoutMs = 30000) {
  const container = docker.getContainer(id);
  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', cmd],
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
  });
  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      stream.destroy();
      reject(new Error('Tempo limite excedido ao executar o comando'));
    }, timeoutMs);

    const stdout = { write: (b) => (out += b.toString('utf8')) };
    const stderr = { write: (b) => (err += b.toString('utf8')) };
    docker.modem.demuxStream(stream, stdout, stderr);

    stream.on('end', async () => {
      clearTimeout(timer);
      let exitCode = null;
      try {
        exitCode = (await exec.inspect()).ExitCode;
      } catch (_) {
        /* container pode ter parado */
      }
      resolve({ output: out, stderr: err, exitCode });
    });
    stream.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

// ---------- Terminal interativo (docker exec -it) ----------

const terminals = new Map();

const termLog = process.env.DOCKDESK_TERM_LOG
  ? (dir, data) =>
      require('fs').appendFileSync(
        process.env.DOCKDESK_TERM_LOG,
        `${Date.now()} ${dir} ${JSON.stringify(data.toString('utf8'))}\n`
      )
  : null;

// spec: { shell: 'bash' } abre um shell interativo;
//       { command: 'npm run dev' } roda o comando em um TTY (via sh -c)
async function openTerminal(id, spec, termId, onData, onExit) {
  const container = docker.getContainer(id);
  const exec = await container.exec({
    Cmd: spec.command ? ['/bin/sh', '-c', spec.command] : [spec.shell],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Env: ['TERM=xterm-256color'],
  });
  const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

  stream.on('data', (chunk) => {
    if (termLog) termLog('OUT', chunk);
    onData(chunk);
  });
  stream.on('end', () => {
    terminals.delete(termId);
    onExit();
  });
  stream.on('error', () => {
    terminals.delete(termId);
    onExit();
  });

  terminals.set(termId, { exec, stream });
  return termId;
}

function writeTerminal(termId, data) {
  const t = terminals.get(termId);
  if (termLog) termLog(t ? 'IN' : 'IN-DROPPED', Buffer.from(data));
  if (t) t.stream.write(data);
}

async function resizeTerminal(termId, cols, rows) {
  const t = terminals.get(termId);
  if (termLog) termLog('RESIZE', Buffer.from(`${cols}x${rows}`));
  if (t) {
    try {
      await t.exec.resize({ w: cols, h: rows });
    } catch (_) {
      /* exec pode já ter terminado */
    }
  }
}

function closeTerminal(termId) {
  const t = terminals.get(termId);
  if (t) {
    try {
      t.stream.destroy();
    } catch (_) {}
    terminals.delete(termId);
  }
}

// ---------- Logs ----------

const logStreams = new Map();

async function startLogs(id, onData) {
  stopLogs(id);
  const container = docker.getContainer(id);
  const info = await container.inspect();
  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 300,
  });
  logStreams.set(id, stream);

  if (info.Config.Tty) {
    stream.on('data', (chunk) => onData(chunk.toString('utf8')));
  } else {
    const sink = { write: (b) => onData(b.toString('utf8')) };
    docker.modem.demuxStream(stream, sink, sink);
  }
  stream.on('error', () => logStreams.delete(id));
  stream.on('end', () => logStreams.delete(id));
}

function stopLogs(id) {
  const s = logStreams.get(id);
  if (s) {
    try {
      s.destroy();
    } catch (_) {}
    logStreams.delete(id);
  }
}

// ---------- Volumes ----------

async function listVolumes() {
  const [data, containers] = await Promise.all([
    docker.listVolumes(),
    docker.listContainers({ all: true }),
  ]);
  const usage = {};
  for (const c of containers) {
    const cname = (c.Names && c.Names[0] ? c.Names[0] : '').replace(/^\//, '');
    for (const m of c.Mounts || []) {
      if (m.Type === 'volume' && m.Name) {
        (usage[m.Name] = usage[m.Name] || []).push(cname);
      }
    }
  }
  return (data.Volumes || [])
    .map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      created: v.CreatedAt || null,
      project: (v.Labels && v.Labels['com.docker.compose.project']) || null,
      usedBy: usage[v.Name] || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function removeVolume(name) {
  await docker.getVolume(name).remove();
  return { ok: true };
}

// ---------- Redes ----------

const BUILTIN_NETWORKS = new Set(['bridge', 'host', 'none']);

async function listNetworks() {
  const nets = await docker.listNetworks();
  const detailed = await Promise.all(
    nets.map(async (n) => {
      let attached = [];
      try {
        const info = await docker.getNetwork(n.Id).inspect();
        attached = Object.values(info.Containers || {}).map((c) => c.Name);
      } catch (_) {
        /* rede pode ter sumido entre o list e o inspect */
      }
      return {
        id: n.Id,
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        builtin: BUILTIN_NETWORKS.has(n.Name),
        project: (n.Labels && n.Labels['com.docker.compose.project']) || null,
        containers: attached,
      };
    })
  );
  return detailed.sort((a, b) => a.name.localeCompare(b.name));
}

async function removeNetwork(id) {
  await docker.getNetwork(id).remove();
  return { ok: true };
}

// ---------- Imagens ----------

async function listImages() {
  const images = await docker.listImages();
  return images.map((img) => ({
    id: img.Id,
    shortId: img.Id.replace('sha256:', '').slice(0, 12),
    tags: (img.RepoTags || []).filter((t) => t !== '<none>:<none>'),
    size: img.Size,
    created: img.Created,
    project: (img.Labels && img.Labels['com.docker.compose.project']) || null,
  }));
}

async function removeImage(id) {
  await docker.getImage(id).remove();
  return { ok: true };
}

module.exports = {
  ping,
  listContainers,
  containerAction,
  inspectContainer,
  getStats,
  detectShells,
  execCommand,
  openTerminal,
  writeTerminal,
  resizeTerminal,
  closeTerminal,
  startLogs,
  stopLogs,
  listImages,
  removeImage,
  listVolumes,
  removeVolume,
  listNetworks,
  removeNetwork,
};
