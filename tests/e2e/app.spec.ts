import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import {
  FIXTURE_CONTAINER,
  COMPOSE_PROJECT_DIR_NAME,
  composeRoot,
  userDataDir,
  sh,
} from './fixtures';

let app: ElectronApplication;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..', '..')],
    env: {
      ...process.env,
      DOCKDESK_USERDATA: userDataDir,
    },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
});

test('abre o app e conecta na engine do Docker', async () => {
  await expect(page.getByTestId('engine-status')).toContainText(/Docker \d/, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('containers-view')).toBeVisible();
});

test('lista o container de teste como Rodando', async () => {
  const card = page.getByTestId(`container-${FIXTURE_CONTAINER}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`badge-${FIXTURE_CONTAINER}`)).toHaveText('Rodando');
  await expect(card).toContainText('alpine');
});

test('mostra métricas de CPU/MEM do container rodando', async () => {
  const card = page.getByTestId(`container-${FIXTURE_CONTAINER}`);
  // as métricas chegam pelo polling de stats (a primeira coleta demora ~2s)
  await expect(card.locator('.metric-value').first()).toContainText('%', {
    timeout: 30_000,
  });
});

test('abre a visão geral com detalhes do container', async () => {
  await page.getByTestId(`container-${FIXTURE_CONTAINER}`).click();
  await expect(page.getByTestId('container-drawer')).toBeVisible();
  await expect(page.getByTestId('overview-pane')).toContainText('alpine');
  await expect(page.getByTestId('overview-pane')).toContainText('IP interno');
});

test('detecta shells disponíveis na imagem', async () => {
  await page.getByTestId('tab-terminal').click();
  await expect(page.getByTestId('shell-picker')).toBeVisible({ timeout: 30_000 });
  // alpine traz sh e ash, mas não bash
  await expect(page.getByTestId('shell-sh')).toBeVisible();
  await expect(page.getByTestId('shell-ash')).toBeVisible();
  await expect(page.getByTestId('shell-bash')).toHaveCount(0);
});

test('abre terminal interativo e executa comando (docker exec -it)', async () => {
  await page.getByTestId('shell-sh').click();
  await page.getByTestId('open-terminal').click();
  const session = page.getByTestId('terminal-session');
  await expect(session).toBeVisible();
  // espera o prompt do shell aparecer e a sessão estabilizar (resize inicial do TTY)
  await expect(session.locator('.xterm-rows')).toContainText(/[#$]/, { timeout: 20_000 });
  await page.waitForTimeout(800);
  await session.locator('.xterm').click();
  await page.keyboard.type('echo terminal-interativo-$((40+2))', { delay: 30 });
  await page.keyboard.press('Enter');
  await expect(session.locator('.xterm-rows')).toContainText('terminal-interativo-42', {
    timeout: 15_000,
  });
});

test('executa comando avulso e mostra a saída (docker exec)', async () => {
  await page.getByTestId('tab-exec').click();
  await page.getByTestId('exec-input').fill('echo saida-do-exec-ok && uname -s');
  await page.getByTestId('exec-run').click();
  const out = page.getByTestId('exec-output');
  await expect(out).toContainText('saida-do-exec-ok', { timeout: 20_000 });
  await expect(out).toContainText('Linux');
});

test('mostra os logs do container', async () => {
  await page.getByTestId('tab-logs').click();
  await expect(page.getByTestId('logs-output')).toContainText('dockdesk-hello-log', {
    timeout: 20_000,
  });
});

test('para e liga o container pela interface', async () => {
  await page.getByTestId('drawer-stop').click();
  await expect(page.getByTestId(`badge-${FIXTURE_CONTAINER}`)).toHaveText('Parado', {
    timeout: 40_000,
  });
  expect(sh(`docker inspect -f '{{.State.Status}}' ${FIXTURE_CONTAINER}`)).toBe('exited');

  await page.getByTestId('drawer-start').click();
  await expect(page.getByTestId(`badge-${FIXTURE_CONTAINER}`)).toHaveText('Rodando', {
    timeout: 40_000,
  });
  expect(sh(`docker inspect -f '{{.State.Status}}' ${FIXTURE_CONTAINER}`)).toBe('running');

  await page.getByTestId('drawer-close').click();
  await expect(page.getByTestId('container-drawer')).toHaveCount(0);
});

test('reinicia o container pela interface', async () => {
  const startedBefore = sh(`docker inspect -f '{{.State.StartedAt}}' ${FIXTURE_CONTAINER}`);
  await page.getByTestId(`restart-${FIXTURE_CONTAINER}`).click();
  await expect(page.getByTestId(`badge-${FIXTURE_CONTAINER}`)).toHaveText('Rodando', {
    timeout: 40_000,
  });
  await expect
    .poll(() => sh(`docker inspect -f '{{.State.StartedAt}}' ${FIXTURE_CONTAINER}`), {
      timeout: 30_000,
    })
    .not.toBe(startedBefore);
});

test('filtra containers pela busca', async () => {
  await page.getByTestId('container-search').fill(FIXTURE_CONTAINER);
  await expect(page.getByTestId(`container-${FIXTURE_CONTAINER}`)).toBeVisible();
  await page.getByTestId('container-search').fill('nome-que-nao-existe-xyz');
  await expect(page.getByTestId(`container-${FIXTURE_CONTAINER}`)).toHaveCount(0);
  await page.getByTestId('container-search').fill('');
});

test('descobre projetos docker-compose na pasta configurada', async () => {
  await page.getByTestId('nav-compose').click();
  await expect(page.getByTestId('compose-view')).toBeVisible();

  // adiciona a pasta programaticamente (o diálogo nativo não é testável)
  await page.evaluate(
    (folder) => window.dockdesk.compose.addFolderPath(folder),
    composeRoot
  );
  await page.getByTestId('compose-refresh').click();

  const card = page.getByTestId(`compose-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('docker-compose.yml');
  await expect(card).toContainText('web');
  await expect(card).toContainText('worker');
});

test('sobe o projeto compose com um clique (up -d)', async () => {
  test.setTimeout(180_000);
  await page.getByTestId(`compose-up-${COMPOSE_PROJECT_DIR_NAME}`).click();
  const consoleBox = page.getByTestId(`compose-console-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(consoleBox).toBeVisible();
  await expect(consoleBox).toContainText('Concluído com sucesso', { timeout: 120_000 });

  const runningServices = sh(
    `docker compose -f ${composeRoot}/${COMPOSE_PROJECT_DIR_NAME}/docker-compose.yml ps --services --status running`
  );
  expect(runningServices).toContain('web');
  expect(runningServices).toContain('worker');

  await expect(page.getByTestId(`compose-${COMPOSE_PROJECT_DIR_NAME}`)).toContainText(
    '2/2 rodando',
    { timeout: 30_000 }
  );
});

test('containers do compose aparecem na lista com a tag do projeto', async () => {
  await page.getByTestId('nav-containers').click();
  const composeContainer = page.locator(
    `[data-testid^="container-${COMPOSE_PROJECT_DIR_NAME}-web"]`
  );
  await expect(composeContainer).toBeVisible({ timeout: 20_000 });
  await expect(composeContainer.locator('.compose-tag')).toContainText(
    COMPOSE_PROJECT_DIR_NAME
  );
});

test('derruba o projeto compose (down)', async () => {
  test.setTimeout(180_000);
  await page.getByTestId('nav-compose').click();
  await page.getByTestId(`compose-down-${COMPOSE_PROJECT_DIR_NAME}`).click();
  const consoleBox = page.getByTestId(`compose-console-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(consoleBox).toContainText('Concluído com sucesso', { timeout: 120_000 });

  const out = sh(
    `docker compose -f ${composeRoot}/${COMPOSE_PROJECT_DIR_NAME}/docker-compose.yml ps --services --status running || true`
  );
  expect(out.trim()).toBe('');
});

test('lista imagens locais', async () => {
  await page.getByTestId('nav-images').click();
  await expect(page.getByTestId('images-view')).toBeVisible();
  await expect(page.getByTestId('images-view')).toContainText('alpine', {
    timeout: 20_000,
  });
});

test('remove o container de teste pela interface', async () => {
  await page.getByTestId('nav-containers').click();
  // precisa estar parado para remover pelo card
  sh(`docker stop -t 2 ${FIXTURE_CONTAINER}`);
  await expect(page.getByTestId(`badge-${FIXTURE_CONTAINER}`)).toHaveText('Parado', {
    timeout: 30_000,
  });
  await page.getByTestId(`remove-${FIXTURE_CONTAINER}`).click();
  await page.getByTestId(`confirm-remove-${FIXTURE_CONTAINER}`).click();
  await expect(page.getByTestId(`container-${FIXTURE_CONTAINER}`)).toHaveCount(0, {
    timeout: 30_000,
  });
  const exists = sh(
    `docker ps -a --filter name=^/${FIXTURE_CONTAINER}$ --format '{{.Names}}' || true`
  );
  expect(exists.trim()).toBe('');
});
