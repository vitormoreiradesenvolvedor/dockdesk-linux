# DockDesk

Interface gráfica amigável para gerenciamento de containers Docker no Linux, feita para
desenvolvedores que **não** querem decorar comandos do Docker.

![DockDesk](build/icon.svg)

## Recursos

- **Containers** — lista com status ao vivo, uso de CPU e memória, portas mapeadas e tag
  do projeto Compose. Ligar, parar, reiniciar e remover com um clique.
- **Terminal interativo** — equivalente a `docker exec -it`, com detecção automática dos
  shells disponíveis na imagem (bash, zsh, fish, ash, sh…) para você escolher.
- **Executar comando** — roda comandos avulsos dentro do container e mostra a saída,
  sem abrir terminal.
- **Logs ao vivo** — acompanha os logs do container em tempo real.
- **Projetos Compose** — aponte a pasta dos seus projetos e o DockDesk encontra os
  `docker-compose.yml` automaticamente; `up -d`, `down` e `restart` com um clique e
  console com a saída.
- **Imagens** — lista e remoção de imagens locais.

## Requisitos

- Linux com Docker Engine rodando e seu usuário no grupo `docker`
  (`sudo usermod -aG docker $USER`).
- Docker Compose v2 (`docker compose`) para a área de projetos.

## Desenvolvimento

```bash
npm install
npm start            # build do renderer + abre o app
npm run test:e2e     # testes end-to-end (Playwright + Docker real)
npm run dist         # gera o AppImage em release/
```

## Fluxo de Git e governança

O fluxo é único: **master ⬅ development**. As regras são aplicadas em duas camadas —
hooks locais (`.githooks/`, ativados automaticamente pelo `npm install` via script
`prepare`) e workflows no GitHub (`.github/workflows/guard-*.yml`). A whitelist de
usuários autorizados fica em [`.github/authorized-users.json`](.github/authorized-users.json),
compartilhada pelas duas camadas.

Para quem **não** está na whitelist:

- Não cria branch a partir da `master` (crie da `development`);
- Não altera a `master` local (commit/merge/reset) — o único sentido de merge
  permitido é `git checkout SUA-BRANCH && git merge master`;
- Não abre PR para a `master`, nem PR partindo da `master`;
- Nome de branch, mensagens de commit e título de PR devem seguir
  [docs/padroes-git-branch-commit-pr.md](docs/padroes-git-branch-commit-pr.md)
  (`acao/descricao-kebab-case` e `**Ação:** descrição`).

A cada atualização da `master`, o workflow de release compara a versão do
`package.json` com as tags existentes: versão igual ou inferior reprova o pipeline;
versão superior cria a tag `vX.Y.Z`, gera o AppImage e publica o Release.

## Arquitetura

- `electron/` — processo principal: fala com o Docker via socket
  (`/var/run/docker.sock`, dockerode) e expõe uma API segura via `contextBridge`.
- `src/` — renderer em React + TypeScript (Vite), terminal com xterm.js.
- `tests/e2e/` — Playwright dirigindo o app Electron real contra o Docker da máquina.
