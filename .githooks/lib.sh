#!/usr/bin/env bash
# Funções compartilhadas pelos hooks locais do DockDesk.
# A whitelist fica em .github/authorized-users.json (compartilhada com os
# workflows do GitHub Actions).

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
AUTH_FILE="$REPO_ROOT/.github/authorized-users.json"

BRANCH_REGEX='^(feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf)/[a-z0-9]+(-[a-z0-9]+)*$'
COMMIT_REGEX='^\*\*(Feature|Add|Mod|Fix|Del|Rename|Mov|Refactor|Style|Docs|Test|Chore|Perf):\*\* .+'

# Retorna 0 (sucesso) se o usuário git local está na whitelist.
is_authorized() {
  [ -f "$AUTH_FILE" ] || return 1
  local name email
  name="$(git config user.name 2>/dev/null)"
  email="$(git config user.email 2>/dev/null)"
  AUTH_FILE="$AUTH_FILE" GIT_NAME="$name" GIT_EMAIL="$email" node -e '
    const fs = require("fs");
    try {
      const data = JSON.parse(fs.readFileSync(process.env.AUTH_FILE, "utf8"));
      const list = data.authorized || [];
      const name = (process.env.GIT_NAME || "").toLowerCase();
      const email = (process.env.GIT_EMAIL || "").toLowerCase();
      const ok = list.some(
        (u) =>
          (u.email && u.email.toLowerCase() === email) ||
          (u.name && u.name.toLowerCase() === name) ||
          (u.github && u.github.toLowerCase() === name)
      );
      process.exit(ok ? 0 : 1);
    } catch (e) {
      process.exit(1);
    }
  ' 2>/dev/null
}

deny() {
  echo "" >&2
  echo "✖ [DockDesk git-guard] $1" >&2
  echo "" >&2
  exit 1
}
