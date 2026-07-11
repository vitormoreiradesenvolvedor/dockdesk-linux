import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const FIXTURE_CONTAINER = 'dockdesk-e2e';
export const COMPOSE_PROJECT_DIR_NAME = 'dockdesk-e2e-proj';

export const tmpRoot = path.join(os.tmpdir(), 'dockdesk-e2e');
export const userDataDir = path.join(tmpRoot, 'userdata');
export const composeRoot = path.join(tmpRoot, 'projects');
export const composeProjectDir = path.join(composeRoot, COMPOSE_PROJECT_DIR_NAME);

export function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function setupFixtures() {
  // limpa resquícios de execuções anteriores
  teardownFixtures();
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(composeProjectDir, { recursive: true });

  // container de teste: loga uma linha e dorme; --init para parar rápido
  sh(
    `docker run -d --init --name ${FIXTURE_CONTAINER} alpine sh -c "echo dockdesk-hello-log; sleep 3600"`
  );

  // projeto compose de teste
  fs.writeFileSync(
    path.join(composeProjectDir, 'docker-compose.yml'),
    [
      'services:',
      '  web:',
      '    image: alpine',
      '    init: true',
      '    command: sleep 3600',
      '    volumes:',
      '      - dados:/dados',
      '  worker:',
      '    image: alpine',
      '    init: true',
      '    command: sleep 3600',
      'volumes:',
      '  dados: {}',
      '',
    ].join('\n')
  );
}

export function teardownFixtures() {
  try {
    sh(`docker rm -f ${FIXTURE_CONTAINER}`);
  } catch (_) {}
  try {
    sh(
      `docker compose -f ${path.join(composeProjectDir, 'docker-compose.yml')} down --remove-orphans -v -t 2`
    );
  } catch (_) {}
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
