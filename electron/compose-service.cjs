'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const YAML = require('yaml');

const COMPOSE_FILE_RE = /^(docker-)?compose(\..+)?\.ya?ml$/;
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', 'target',
  '.cache', '.venv', 'venv', '__pycache__', '.next', '.nuxt',
]);
const MAX_DEPTH = 4;

function findComposeFiles(root, depth = 0, results = []) {
  if (depth > MAX_DEPTH) return results;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    if (entry.isFile() && COMPOSE_FILE_RE.test(entry.name)) {
      results.push(path.join(root, entry.name));
    } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      findComposeFiles(path.join(root, entry.name), depth + 1, results);
    }
  }
  return results;
}

function parseServices(file) {
  try {
    const doc = YAML.parse(fs.readFileSync(file, 'utf8'));
    if (doc && typeof doc.services === 'object' && doc.services) {
      return Object.keys(doc.services);
    }
  } catch (_) {
    /* YAML inválido — mostra mesmo assim, sem serviços */
  }
  return [];
}

function scanProjects(folders) {
  const projects = [];
  const seen = new Set();
  for (const folder of folders) {
    for (const file of findComposeFiles(folder)) {
      if (seen.has(file)) continue;
      seen.add(file);
      projects.push({
        file,
        dir: path.dirname(file),
        name: path.basename(path.dirname(file)),
        fileName: path.basename(file),
        services: parseServices(file),
        rootFolder: folder,
      });
    }
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function runCompose(file, args, onOutput) {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', '-f', file, ...args], {
      cwd: path.dirname(file),
      env: process.env,
    });
    proc.stdout.on('data', (b) => onOutput(b.toString('utf8')));
    proc.stderr.on('data', (b) => onOutput(b.toString('utf8')));
    proc.on('error', (err) => {
      onOutput(`\nErro ao executar docker compose: ${err.message}\n`);
      resolve({ exitCode: -1 });
    });
    proc.on('close', (code) => resolve({ exitCode: code }));
  });
}

async function projectStatus(file) {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', '-f', file, 'ps', '--format', 'json'], {
      cwd: path.dirname(file),
    });
    let out = '';
    proc.stdout.on('data', (b) => (out += b.toString('utf8')));
    proc.on('error', () => resolve({ running: 0, total: 0, containers: [] }));
    proc.on('close', () => {
      const containers = [];
      for (const line of out.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          // compose v2 pode emitir um array em JSON ou NDJSON por linha
          if (Array.isArray(obj)) containers.push(...obj);
          else containers.push(obj);
        } catch (_) {}
      }
      const running = containers.filter((c) => (c.State || '').toLowerCase() === 'running').length;
      resolve({
        running,
        total: containers.length,
        containers: containers.map((c) => ({
          name: c.Name,
          service: c.Service,
          state: c.State,
          status: c.Status,
        })),
      });
    });
  });
}

module.exports = { scanProjects, runCompose, projectStatus };
