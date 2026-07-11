# Governança de Git — DockDesk

🌐 **Português (BR)** · [English](governanca.en.md) · [中文](governanca.zh.md) · [हिन्दी](governanca.hi.md) · [Español](governanca.es.md) · [Français](governanca.fr.md)

O fluxo é único: **master ⬅ development**. As regras são aplicadas em duas camadas:

1. **Hooks locais** (`.githooks/`) — ativados automaticamente pelo `npm install`
   (script `prepare` configura `core.hooksPath`);
2. **Workflows no GitHub** (`.github/workflows/guard-*.yml`).

A whitelist de usuários autorizados fica em
[`.github/authorized-users.json`](../../.github/authorized-users.json)
(campos `github`, `name` e `email`), compartilhada pelas duas camadas.

## Regras para quem NÃO está na whitelist

- **Não cria branch a partir da `master`** — crie a partir da `development`;
- **Não altera a `master` local** (commit, merge, reset). O único sentido de merge
  permitido é atualizar a sua branch: `git checkout SUA-BRANCH && git merge master`;
- **Não abre PR para a `master`**, nem PR **partindo** da `master` (inclusive para a
  `development`) — PRs em violação são reprovados e fechados automaticamente;
- **Nome de branch**: `acao/descricao-em-kebab-case`
  (ações: `feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`);
- **Mensagem de commit**: `**Ação:** descrição` (ex.: `**Add:** Open Modal`);
- **Título de PR**: mesmo padrão dos commits.

Os padrões completos, com exemplos e checklist, estão em
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md).

## Release automatizado

A cada atualização da `master`, o workflow de release:

1. Lê a versão do `package.json`;
2. Se for **igual ou inferior** à maior tag existente → o pipeline **reprova**;
3. Se for **superior** → cria a tag `vX.Y.Z`, gera o **AppImage** e publica um
   GitHub Release com o binário anexado.

## Observação sobre a camada local

Hooks de git não viajam no clone (comportamento do próprio git). Eles passam a
valer após o primeiro `npm install` do clone — o fluxo normal de qualquer dev.
Quem nunca instalar as dependências não terá os guards locais, mas continua
barrado pelas camadas do servidor (workflows + proteção de branch).
