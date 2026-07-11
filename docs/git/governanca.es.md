# Gobernanza de Git — DockDesk

🌐 [Português (BR)](governanca.pt.md) · [English](governanca.en.md) · [中文](governanca.zh.md) · [हिन्दी](governanca.hi.md) · **Español** · [Français](governanca.fr.md)

El flujo es único: **master ⬅ development**. Las reglas se aplican en dos capas:

1. **Hooks locales** (`.githooks/`) — activados automáticamente por `npm install`
   (el script `prepare` configura `core.hooksPath`);
2. **Workflows de GitHub** (`.github/workflows/guard-*.yml`).

La whitelist de usuarios autorizados está en
[`.github/authorized-users.json`](../../.github/authorized-users.json)
(campos `github`, `name` y `email`), compartida por ambas capas.

## Reglas para quien NO está en la whitelist

- **No crear branch desde `master`** — crea tu branch desde `development`;
- **No modificar la `master` local** (commit, merge, reset). La única dirección de
  merge permitida es actualizar tu branch: `git checkout TU-BRANCH && git merge master`;
- **No abrir PR hacia `master`**, ni PR **desde** `master` (incluso hacia
  `development`) — los PR en violación se reprueban y cierran automáticamente;
- **Nombre de branch**: `accion/descripcion-en-kebab-case`
  (acciones: `feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`);
- **Mensaje de commit**: `**Acción:** descripción` (ej.: `**Add:** Open Modal`);
- **Título del PR**: mismo patrón que los commits.

Los estándares completos, con ejemplos y checklist, están en
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md) (portugués).

## Release automatizado

En cada actualización de `master`, el workflow de release:

1. Lee la versión del `package.json`;
2. Si es **igual o inferior** a la mayor tag existente → el pipeline **falla**;
3. Si es **superior** → crea la tag `vX.Y.Z`, genera el **AppImage** y publica un
   GitHub Release con el binario adjunto.

## Nota sobre la capa local

Los hooks de git no viajan con el clon (comportamiento del propio git). Entran en
vigor tras el primer `npm install` del clon — el flujo normal de cualquier dev.
Quien nunca instale las dependencias no tendrá los guards locales, pero sigue
bloqueado por las capas del servidor (workflows + protección de branch).
