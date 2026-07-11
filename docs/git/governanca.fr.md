# Gouvernance Git — DockDesk

🌐 [Português (BR)](governanca.pt.md) · [English](governanca.en.md) · [中文](governanca.zh.md) · [हिन्दी](governanca.hi.md) · [Español](governanca.es.md) · **Français**

Le flux est unique : **master ⬅ development**. Les règles sont appliquées en deux couches :

1. **Hooks locaux** (`.githooks/`) — activés automatiquement par `npm install`
   (le script `prepare` configure `core.hooksPath`) ;
2. **Workflows GitHub** (`.github/workflows/guard-*.yml`).

La whitelist des utilisateurs autorisés se trouve dans
[`.github/authorized-users.json`](../../.github/authorized-users.json)
(champs `github`, `name` et `email`), partagée par les deux couches.

## Règles pour qui N'EST PAS dans la whitelist

- **Pas de branche créée depuis `master`** — créez votre branche depuis `development` ;
- **Pas de modification locale de `master`** (commit, merge, reset). La seule
  direction de merge autorisée est la mise à jour de votre branche :
  `git checkout VOTRE-BRANCHE && git merge master` ;
- **Pas de PR vers `master`**, ni de PR **depuis** `master` (y compris vers
  `development`) — les PR en violation échouent et sont fermées automatiquement ;
- **Nom de branche** : `action/description-en-kebab-case`
  (actions : `feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`) ;
- **Message de commit** : `**Action:** description` (ex. : `**Add:** Open Modal`) ;
- **Titre de PR** : même modèle que les commits.

Les standards complets, avec exemples et checklist, sont dans
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md) (portugais).

## Release automatisée

À chaque mise à jour de `master`, le workflow de release :

1. Lit la version du `package.json` ;
2. Si elle est **égale ou inférieure** au plus grand tag existant → le pipeline **échoue** ;
3. Si elle est **supérieure** → il crée le tag `vX.Y.Z`, construit l'**AppImage** et
   publie une GitHub Release avec le binaire attaché.

## Note sur la couche locale

Les hooks git ne voyagent pas avec le clone (comportement de git lui-même). Ils
prennent effet après le premier `npm install` du clone — le flux normal de tout
développeur. Qui n'installe jamais les dépendances n'aura pas les gardes locales,
mais reste bloqué par les couches serveur (workflows + protection de branche).
