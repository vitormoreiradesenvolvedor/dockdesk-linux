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

// grupos começam recolhidos por padrão; expande se houver cabeçalho
async function expandGroup(toggleTestId: string) {
  const toggle = page.getByTestId(toggleTestId);
  if ((await toggle.count()) === 0) return; // sem cabeçalho = sempre expandido
  const cls = (await toggle.locator('.chevron').getAttribute('class')) ?? '';
  if (cls.includes('closed')) await toggle.click();
}

test('abre o app e conecta na engine do Docker', async () => {
  await expect(page.getByTestId('engine-status')).toContainText(/Docker \d/, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('containers-view')).toBeVisible();
  // rodapé também mostra a versão do DockDesk
  await expect(page.getByTestId('app-version')).toContainText(/DockDesk v\d+\.\d+\.\d+/);
});

test('alterna entre modo claro e escuro', async () => {
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByTestId('theme-toggle').click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('dockdesk-theme'))).toBe('light');
  await page.getByTestId('theme-toggle').click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});

test('troca o idioma do app (6 idiomas) e volta para pt-BR', async () => {
  const select = page.getByTestId('lang-select');
  await expect(page.getByTestId('nav-compose')).toContainText('Projetos Compose');

  await select.selectOption('en');
  await expect(page.getByTestId('nav-compose')).toContainText('Compose Projects');
  await expect(page.getByTestId('nav-networks')).toContainText('Networks');

  await select.selectOption('zh');
  await expect(page.getByTestId('nav-containers')).toContainText('容器');

  await select.selectOption('hi');
  await expect(page.getByTestId('nav-images')).toContainText('इमेज');

  await select.selectOption('es');
  await expect(page.getByTestId('nav-volumes')).toContainText('Volúmenes');

  await select.selectOption('fr');
  await expect(page.getByTestId('nav-networks')).toContainText('Réseaux');

  await select.selectOption('pt');
  await expect(page.getByTestId('nav-compose')).toContainText('Projetos Compose');
});

test('permite desativar o ícone da bandeja pelo rodapé', async () => {
  const toggle = page.getByTestId('tray-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeChecked();

  await toggle.uncheck();
  await expect
    .poll(() => page.evaluate(() => window.dockdesk.settings.getTrayEnabled()))
    .toBe(false);

  // reativa para não afetar o resto da suíte
  await toggle.check();
  await expect
    .poll(() => page.evaluate(() => window.dockdesk.settings.getTrayEnabled()))
    .toBe(true);
});

test('lista o container de teste como Rodando', async () => {
  // aguarda o polling montar os grupos e expande o de avulsos (padrão: recolhido)
  await expect
    .poll(async () => page.getByTestId('group-avulsos').count(), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await expandGroup('group-toggle-avulsos');
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

test('mantém terminal e saída do exec ao alternar abas, com botão de limpar', async () => {
  // volta para o terminal: a sessão aberta antes deve continuar viva
  await page.getByTestId('tab-terminal').click();
  await expect(
    page.getByTestId('terminal-session').locator('.xterm-rows')
  ).toContainText('terminal-interativo-42');

  // volta para o exec: a saída anterior deve continuar lá
  await page.getByTestId('tab-exec').click();
  await expect(page.getByTestId('exec-output')).toContainText('saida-do-exec-ok');

  // limpar zera a saída
  await page.getByTestId('exec-clear').click();
  await expect(page.getByTestId('exec-output')).not.toContainText('saida-do-exec-ok');
});

test('executa rotina com terminal atrelado à linha e indicador de execução', async () => {
  await page.getByTestId('tab-routines').click();
  await expect(page.getByTestId('routines-pane')).toBeVisible();

  await page.getByTestId('routine-new').click();
  await page.getByTestId('routine-label-input').fill('Diagnóstico');
  await page
    .getByTestId('routine-command-input')
    .fill('echo rotina-simples-$((700+77)) && sleep 2');
  await page.getByTestId('routine-save').click();

  await page.getByTestId('routine-run-Diagnóstico').click();

  // enquanto roda: indicador na linha + terminal sanfonado atrelado
  await expect(page.getByTestId('routine-running-Diagnóstico')).toBeVisible();
  const term = page.getByTestId('routine-terminal-Diagnóstico');
  await expect(term).toBeVisible();
  await expect(term.locator('.xterm-rows')).toContainText('rotina-simples-777', {
    timeout: 20_000,
  });

  // dá para minimizar o terminal sem matar a sessão, e expandir de volta
  await page.getByTestId('routine-toggle-term-Diagnóstico').click();
  await expect(term).toBeHidden();
  await page.getByTestId('routine-toggle-term-Diagnóstico').click();
  await expect(term).toBeVisible();
  await expect(term.locator('.xterm-rows')).toContainText('rotina-simples-777');

  // quando o comando termina: indicador some, status de finalizado aparece
  await expect(page.getByTestId('routine-running-Diagnóstico')).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(term).toContainText('Comando finalizado');
  await page.getByTestId('routine-close-Diagnóstico').click();
  await expect(term).toHaveCount(0);
});

test('executa rotina parcial pedindo complemento em modal', async () => {
  await page.getByTestId('routine-new').click();
  await page.getByTestId('routine-label-input').fill('Preparar');
  await page.getByTestId('routine-command-input').fill('echo inicio');
  await page.getByTestId('routine-partial-check').check();
  await page.getByTestId('routine-save').click();

  await page.getByTestId('routine-run-Preparar').click();
  await expect(page.getByTestId('complement-modal')).toBeVisible();
  await page.getByTestId('complement-input').fill('&& echo fim-parcial-$((800+88))');
  await page.getByTestId('complement-run').click();

  const term = page.getByTestId('routine-terminal-Preparar');
  await expect(term.locator('.xterm-rows')).toContainText('fim-parcial-888', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('routine-close-Preparar')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('routine-close-Preparar').click();

  // rotinas ficam persistidas
  await expect(page.getByTestId('routine-Diagnóstico')).toBeVisible();
  await expect(page.getByTestId('routine-Preparar')).toContainText('complementável');
});

test('rotina com marcador [--] insere o complemento em cada marcador', async () => {
  await page.getByTestId('routine-new').click();
  await page.getByTestId('routine-label-input').fill('Marcador');
  // duas ocorrências: o complemento tem de entrar nas duas
  await page
    .getByTestId('routine-command-input')
    .fill('echo alvo-[--] && echo eco-[--]');

  // o marcador liga o modo parcial sozinho e trava o checkbox
  const partialCheck = page.getByTestId('routine-partial-check');
  await expect(partialCheck).toBeChecked();
  await expect(partialCheck).toBeDisabled();
  await expect(page.getByTestId('routine-tips')).toBeVisible();
  await page.getByTestId('routine-save').click();

  await expect(page.getByTestId('routine-Marcador')).toContainText('marcador [--]');

  await page.getByTestId('routine-run-Marcador').click();
  await expect(page.getByTestId('complement-modal')).toBeVisible();
  // com o campo vazio a prévia ainda mostra onde o complemento vai entrar
  await expect(page.getByTestId('complement-preview')).toContainText('echo alvo-[--]');
  await page.getByTestId('complement-input').fill('999');
  await expect(page.getByTestId('complement-preview')).toContainText(
    'echo alvo-999 && echo eco-999'
  );
  await page.getByTestId('complement-run').click();

  const term = page.getByTestId('routine-terminal-Marcador');
  await expect(term.locator('.xterm-rows')).toContainText('alvo-999', { timeout: 20_000 });
  await expect(term.locator('.xterm-rows')).toContainText('eco-999', { timeout: 20_000 });
  await expect(page.getByTestId('routine-close-Marcador')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('routine-close-Marcador').click();
});

test('rotina multilinha preserva a quebra de linha na execução', async () => {
  await page.getByTestId('routine-new').click();
  await page.getByTestId('routine-label-input').fill('Multilinha');
  // duas linhas de verdade: o sh -c tem de executar as duas
  await page
    .getByTestId('routine-command-input')
    .fill('echo primeira-linha-111\necho segunda-linha-222');
  await page.getByTestId('routine-save').click();

  // o comando aparece na lista quebrado nas mesmas duas linhas
  await expect(page.getByTestId('routine-Multilinha').locator('.routine-cmd')).toContainText(
    'echo segunda-linha-222'
  );

  await page.getByTestId('routine-run-Multilinha').click();
  const term = page.getByTestId('routine-terminal-Multilinha');
  await expect(term.locator('.xterm-rows')).toContainText('primeira-linha-111', {
    timeout: 20_000,
  });
  await expect(term.locator('.xterm-rows')).toContainText('segunda-linha-222', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('routine-close-Multilinha')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('routine-close-Multilinha').click();
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

  // com tudo rodando o botão Subir some e aparecem Reiniciar/Derrubar
  await expect(page.getByTestId(`compose-up-${COMPOSE_PROJECT_DIR_NAME}`)).toHaveCount(0);
  await expect(page.getByTestId(`compose-down-${COMPOSE_PROJECT_DIR_NAME}`)).toBeVisible();
  await expect(
    page.getByTestId(`compose-restart-${COMPOSE_PROJECT_DIR_NAME}`)
  ).toBeVisible();
});

test('terminal do compose pode ser recolhido e expandido (sanfonado)', async () => {
  const consoleBox = page.getByTestId(`compose-console-${COMPOSE_PROJECT_DIR_NAME}`);
  const toggle = page.getByTestId(`compose-console-toggle-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(consoleBox).toBeVisible();

  await toggle.click();
  await expect(consoleBox).toBeHidden();

  // expande de novo: o conteúdo continua lá
  await toggle.click();
  await expect(consoleBox).toBeVisible();
  await expect(consoleBox).toContainText('Concluído com sucesso');
});

test('estado dos containers do projeto compose atualiza em tempo real', async () => {
  test.setTimeout(120_000);
  const card = page.getByTestId(`compose-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(card).toContainText('2/2 rodando', { timeout: 30_000 });

  // para um serviço por fora do DockDesk: o card deve refletir sozinho,
  // sem clicar em Atualizar
  const webName = sh(
    `docker ps --filter label=com.docker.compose.project=${COMPOSE_PROJECT_DIR_NAME} --filter label=com.docker.compose.service=web --format '{{.Names}}'`
  );
  sh(`docker stop -t 2 ${webName}`);
  await expect(card).toContainText('1/2 rodando', { timeout: 30_000 });

  sh(`docker start ${webName}`);
  await expect(card).toContainText('2/2 rodando', { timeout: 30_000 });
});

test('mostra volumes agrupados pelo projeto compose', async () => {
  await page.getByTestId('nav-volumes').click();
  await expect(page.getByTestId('volumes-view')).toBeVisible();
  const group = page.getByTestId(`volume-group-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(group).toBeVisible({ timeout: 20_000 });
  await expandGroup(`volume-group-toggle-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(
    page.getByTestId(`volume-${COMPOSE_PROJECT_DIR_NAME}_dados`)
  ).toContainText('Em uso');
});

test('mostra redes agrupadas pelo projeto compose', async () => {
  await page.getByTestId('nav-networks').click();
  await expect(page.getByTestId('networks-view')).toBeVisible();
  const group = page.getByTestId(`network-group-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(group).toBeVisible({ timeout: 20_000 });
  await expandGroup(`network-group-toggle-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(
    page.getByTestId(`network-${COMPOSE_PROJECT_DIR_NAME}_default`)
  ).toContainText('conectado');
  // redes padrão do Docker aparecem no grupo de avulsas, sem botão de remover
  await expect(page.getByTestId('network-group-avulsas')).toBeVisible();
  await expandGroup('network-group-toggle-avulsas');
  await expect(page.getByTestId('network-bridge')).toContainText('padrão do Docker');
});

test('containers do compose aparecem agrupados em sanfonado do projeto', async () => {
  await page.getByTestId('nav-containers').click();

  // grupo sanfonado do projeto, com contagem (recolhido por padrão)
  const group = page.getByTestId(`group-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(group).toBeVisible({ timeout: 20_000 });
  await expect(group).toContainText('2/2 rodando');

  const composeContainer = group.locator(
    `[data-testid^="container-${COMPOSE_PROJECT_DIR_NAME}-web"]`
  );
  // padrão: recolhido — só a linha do grupo aparece
  await expect(composeContainer).toHaveCount(0);

  // expandindo, aparecem os containers com a tag do serviço
  await page.getByTestId(`group-toggle-${COMPOSE_PROJECT_DIR_NAME}`).click();
  await expect(composeContainer).toBeVisible();
  await expect(composeContainer.locator('.compose-tag')).toContainText('web');

  // o container avulso fica na seção de avulsos (expandida no início da suíte)
  await expect(
    page.getByTestId('group-avulsos').getByTestId(`container-${FIXTURE_CONTAINER}`)
  ).toBeVisible();
});

test('estado aberto/recolhido dos grupos persiste ao trocar de tela', async () => {
  const group = page.getByTestId(`group-${COMPOSE_PROJECT_DIR_NAME}`);
  const composeContainer = group.locator(
    `[data-testid^="container-${COMPOSE_PROJECT_DIR_NAME}-web"]`
  );
  // deixado expandido no teste anterior; troca de tela e volta
  await expect(composeContainer).toBeVisible();
  await page.getByTestId('nav-images').click();
  await page.getByTestId('nav-containers').click();
  await expect(composeContainer).toBeVisible({ timeout: 20_000 });

  // recolhe, troca de tela e volta: continua recolhido
  await page.getByTestId(`group-toggle-${COMPOSE_PROJECT_DIR_NAME}`).click();
  await expect(composeContainer).toHaveCount(0);
  await page.getByTestId('nav-images').click();
  await page.getByTestId('nav-containers').click();
  await expect(page.getByTestId(`group-${COMPOSE_PROJECT_DIR_NAME}`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page
      .getByTestId(`group-${COMPOSE_PROJECT_DIR_NAME}`)
      .locator(`[data-testid^="container-${COMPOSE_PROJECT_DIR_NAME}-web"]`)
  ).toHaveCount(0);
});

test('desliga e liga todos os containers do grupo pelo cabeçalho', async () => {
  test.setTimeout(120_000);
  const group = page.getByTestId(`group-${COMPOSE_PROJECT_DIR_NAME}`);
  await expect(group).toContainText('2/2 rodando', { timeout: 20_000 });

  // os botões ficam no cabeçalho do grupo, mesmo com ele recolhido
  await page.getByTestId(`group-stop-all-${COMPOSE_PROJECT_DIR_NAME}`).click();
  await expect(group).toContainText('0/2 rodando', { timeout: 60_000 });
  const running = sh(
    `docker ps --filter label=com.docker.compose.project=${COMPOSE_PROJECT_DIR_NAME} --format '{{.Names}}' || true`
  );
  expect(running.trim()).toBe('');
  await expect(page.getByTestId(`group-stop-all-${COMPOSE_PROJECT_DIR_NAME}`)).toHaveCount(0);

  await page.getByTestId(`group-start-all-${COMPOSE_PROJECT_DIR_NAME}`).click();
  await expect(group).toContainText('2/2 rodando', { timeout: 60_000 });
  await expect(page.getByTestId(`group-start-all-${COMPOSE_PROJECT_DIR_NAME}`)).toHaveCount(0);
});

test('reordena grupos arrastando e a ordem fica salva', async () => {
  const groupOrder = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="containers-view"] .group-section')].map(
        (el) => el.getAttribute('data-testid')
      )
    );

  // ordem padrão: grupos de projeto antes, avulsos por último
  let order = await groupOrder();
  expect(order.indexOf('group-avulsos')).toBeGreaterThan(
    order.indexOf(`group-${COMPOSE_PROJECT_DIR_NAME}`)
  );

  // arrasta o grupo de avulsos para a posição do grupo do projeto de teste
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.getByTestId('group-toggle-avulsos').dispatchEvent('dragstart', { dataTransfer });
  await page
    .getByTestId(`group-toggle-${COMPOSE_PROJECT_DIR_NAME}`)
    .dispatchEvent('dragover', { dataTransfer });
  await page
    .getByTestId(`group-toggle-${COMPOSE_PROJECT_DIR_NAME}`)
    .dispatchEvent('drop', { dataTransfer });

  await expect
    .poll(async () => {
      const o = await groupOrder();
      return o.indexOf('group-avulsos') < o.indexOf(`group-${COMPOSE_PROJECT_DIR_NAME}`);
    })
    .toBe(true);

  // a ordem fica persistida para as próximas aberturas do app
  const saved = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('dockdesk-order-containers')))!
  ) as string[];
  expect(saved.indexOf('__loose__')).toBeGreaterThanOrEqual(0);
  expect(saved.indexOf('__loose__')).toBeLessThan(
    saved.indexOf(COMPOSE_PROJECT_DIR_NAME)
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

  // com tudo derrubado, volta o botão Subir e somem Reiniciar/Derrubar
  await expect(page.getByTestId(`compose-up-${COMPOSE_PROJECT_DIR_NAME}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId(`compose-down-${COMPOSE_PROJECT_DIR_NAME}`)).toHaveCount(0);
  await expect(page.getByTestId(`compose-restart-${COMPOSE_PROJECT_DIR_NAME}`)).toHaveCount(0);
});

test('lista imagens locais agrupadas', async () => {
  await page.getByTestId('nav-images').click();
  await expect(page.getByTestId('images-view')).toBeVisible();
  // alpine não foi construída por compose: fica no grupo de avulsas
  await expect(page.getByTestId('image-group-avulsas')).toBeVisible({ timeout: 20_000 });
  await expandGroup('image-group-toggle-avulsas');
  await expect(page.getByTestId('image-group-avulsas')).toContainText('alpine');
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
