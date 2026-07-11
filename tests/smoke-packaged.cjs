// Smoke test do app EMPACOTADO (release/linux-unpacked): abre o binário real,
// confere conexão com a engine e a listagem de containers. Uso:
//   node tests/smoke-packaged.cjs
const { _electron } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');

const CONTAINER = 'dockdesk-smoke';

async function main() {
  execSync(`docker rm -f ${CONTAINER} 2>/dev/null || true`, { shell: '/bin/bash' });
  execSync(`docker run -d --init --name ${CONTAINER} alpine sleep 300`);

  const app = await _electron.launch({
    executablePath: path.join(__dirname, '..', 'release', 'linux-unpacked', 'dockdesk'),
    args: [],
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

    await page.waitForSelector(`[data-testid="container-${CONTAINER}"]`, { timeout: 20000 });
    console.log(`✔ container ${CONTAINER} listado`);

    const badge = await page.textContent(`[data-testid="badge-${CONTAINER}"]`);
    if (badge !== 'Rodando') throw new Error(`badge inesperado: ${badge}`);
    console.log('✔ status "Rodando" exibido');

    console.log('SMOKE OK');
  } finally {
    await app.close();
    execSync(`docker rm -f ${CONTAINER} 2>/dev/null || true`, { shell: '/bin/bash' });
  }
}

main().catch((e) => {
  console.error('SMOKE FALHOU:', e.message);
  process.exit(1);
});
