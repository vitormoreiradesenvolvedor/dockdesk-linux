# Git Governance — DockDesk

🌐 [Português (BR)](governanca.pt.md) · **English** · [中文](governanca.zh.md) · [हिन्दी](governanca.hi.md) · [Español](governanca.es.md) · [Français](governanca.fr.md)

There is a single flow: **master ⬅ development**. Rules are enforced in two layers:

1. **Local hooks** (`.githooks/`) — enabled automatically by `npm install`
   (the `prepare` script sets `core.hooksPath`);
2. **GitHub workflows** (`.github/workflows/guard-*.yml`).

The whitelist of authorized users lives in
[`.github/authorized-users.json`](../../.github/authorized-users.json)
(fields `github`, `name` and `email`), shared by both layers.

## Rules for users NOT in the whitelist

- **No branching off `master`** — create your branch from `development`;
- **No local changes to `master`** (commit, merge, reset). The only allowed merge
  direction is updating your branch: `git checkout YOUR-BRANCH && git merge master`;
- **No PRs targeting `master`**, and no PRs **from** `master` (including to
  `development`) — violating PRs are failed and closed automatically;
- **Branch name**: `action/description-in-kebab-case`
  (actions: `feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`);
- **Commit message**: `**Action:** description` (e.g. `**Add:** Open Modal`);
- **PR title**: same pattern as commits.

The full standards, with examples and checklist, are in
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md) (Portuguese).

## Automated release

On every `master` update, the release workflow:

1. Reads the version from `package.json`;
2. If it is **equal to or lower than** the highest existing tag → the pipeline **fails**;
3. If it is **higher** → it creates the `vX.Y.Z` tag, builds the **AppImage** and
   publishes a GitHub Release with the binary attached.

## Note about the local layer

Git hooks do not travel with clones (git's own behavior). They take effect after
the first `npm install` of the clone — any developer's normal flow. Someone who
never installs dependencies will not have the local guards, but is still blocked
by the server-side layers (workflows + branch protection).
