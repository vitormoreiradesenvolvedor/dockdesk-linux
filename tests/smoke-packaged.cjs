// Smoke test do app EMPACOTADO (release/linux-unpacked): abre o binário real,
// confere conexão com a engine e a listagem de containers. Uso:
//   node tests/smoke-packaged.cjs
const { _electron } = require('@playwright/test');
const { execSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CONTAINER = 'dockdesk-smoke';
// userData isolado: o lock de instância única é por pasta de dados, então o
// smoke não conflita com um DockDesk real rodando na sessão do usuário
const USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'dockdesk-smoke-'));

async function main() {
  execSync(`docker rm -f ${CONTAINER} 2>/dev/null || true`, { shell: '/bin/bash' });
  execSync(`docker run -d --init --name ${CONTAINER} alpine sleep 300`);

  const app = await _electron.launch({
    executablePath: path.join(__dirname, '..', 'release', 'linux-unpacked', 'dockdesk'),
    args: [],
    env: { ...process.env, DOCKDESK_USERDATA: USERDATA },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('[data-testid="engine-status"]', { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="engine-status"]').textContent.includes('Docker'),
      null,
      { timeout: 20000 }
    );
    const engineText = await page.textContent('[data-testid="engine-status"]');
    if (!/Docker \d/.test(engineText)) throw new Error(`Engine não conectou: ${engineText}`);
    console.log(`✔ engine conectada: ${engineText.trim()}`);

    // grupos começam recolhidos: expande o de avulsos se tiver cabeçalho
    await page.waitForSelector('[data-testid="group-avulsos"]', { timeout: 20000 });
    const toggle = await page.$('[data-testid="group-toggle-avulsos"]');
    if (toggle) {
      const cls = await page.$eval(
        '[data-testid="group-toggle-avulsos"] .chevron',
        (el) => el.getAttribute('class') || ''
      );
      if (cls.includes('closed')) await toggle.click();
    }
    await page.waitForSelector(`[data-testid="container-${CONTAINER}"]`, { timeout: 20000 });
    console.log(`✔ container ${CONTAINER} listado`);

    const badge = await page.textContent(`[data-testid="badge-${CONTAINER}"]`);
    if (badge !== 'Rodando') throw new Error(`badge inesperado: ${badge}`);
    console.log('✔ status "Rodando" exibido');

    // instância única: uma segunda execução deve encerrar sozinha em instantes
    const bin = path.join(__dirname, '..', 'release', 'linux-unpacked', 'dockdesk');
    const second = spawn(bin, [], {
      stdio: 'ignore',
      env: { ...process.env, DOCKDESK_USERDATA: USERDATA },
    });
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      second.on('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!exited) {
      second.kill();
      throw new Error('segunda instância não encerrou sozinha');
    }
    console.log('✔ segunda instância encerrou sozinha (lock de instância única)');

    console.log('SMOKE OK');
  } finally {
    await app.close();
    execSync(`docker rm -f ${CONTAINER} 2>/dev/null || true`, { shell: '/bin/bash' });
    fs.rmSync(USERDATA, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('SMOKE FALHOU:', e.message);
  process.exit(1);
});
